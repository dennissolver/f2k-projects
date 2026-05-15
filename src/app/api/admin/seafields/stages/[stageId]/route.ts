import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminUser, hasPermission, auditLog } from "@/lib/admin-auth";
import { createSupabaseService } from "@/lib/supabase-service";

const updateSchema = z.object({
  stage_label: z.string().trim().min(1).max(200).optional(),
  rate_per_sqm: z.number().min(0).max(999999.99).nullable().optional(),
  is_open_for_registration: z.boolean().optional(),
  auto_advance_threshold_pct: z.number().min(0).max(100).optional(),
  public_visible: z.boolean().optional(),
  // Mandatory when ANY material field changes (rate, gating, threshold, visibility).
  // Client is responsible for sending this when required; server enforces below.
  reason: z.string().trim().min(10).max(500).optional(),
});

const MATERIAL_FIELDS = [
  "rate_per_sqm",
  "is_open_for_registration",
  "auto_advance_threshold_pct",
  "public_visible",
] as const;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(
  request: Request,
  { params }: { params: { stageId: string } },
) {
  const admin = await getAdminUser();
  if (!admin || !hasPermission(admin.role, "manage_seafields_stages")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!UUID_RE.test(params.stageId)) {
    return NextResponse.json({ error: "Invalid stage id" }, { status: 400 });
  }

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  const { reason, ...rawUpdates } = parsed.data;

  // Strip undefined so we only patch fields the client actually sent.
  const updates: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rawUpdates)) {
    if (v !== undefined) updates[k] = v;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  // Enforce scoped Reason requirement: required when any MATERIAL_FIELDS change.
  const touchesMaterial = MATERIAL_FIELDS.some((f) => f in updates);
  if (touchesMaterial && (!reason || reason.length < 10)) {
    return NextResponse.json(
      {
        error:
          "A reason (≥10 chars) is required when changing rate, registration status, advance threshold, or public visibility.",
      },
      { status: 400 },
    );
  }

  const supabase = createSupabaseService();

  // Fetch current row so we can audit-log the diff and return the row in the
  // shape the UI expects (the view, not the base table).
  const { data: priorRow, error: priorErr } = await (
    supabase.from("stages") as any
  )
    .select("id, stage_number, stage_label, rate_per_sqm, is_open_for_registration, auto_advance_threshold_pct, public_visible")
    .eq("id", params.stageId)
    .maybeSingle();

  if (priorErr || !priorRow) {
    return NextResponse.json(
      { error: priorErr?.message ?? "Stage not found" },
      { status: priorErr ? 500 : 404 },
    );
  }

  // Perform the update. The DB trigger (trg_audit_stages) will fire and write
  // one audit_log row per changed field — BUT with NULL actor/reason until
  // session-variable plumbing lands in a follow-up session.
  // To avoid losing the actor + reason for now, also write an "intent" audit
  // row at the app layer that carries them explicitly.
  const { error: updateErr } = await (supabase.from("stages") as any)
    .update(updates)
    .eq("id", params.stageId);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // App-level intent log carrying actor + reason. Trigger rows still capture
  // the per-field diff; this row gives them a sibling with attribution until
  // request-header plumbing wires actor/reason into the trigger.
  await auditLog(
    admin.id,
    admin.email,
    touchesMaterial ? "stage_material_update" : "stage_label_update",
    "stage",
    params.stageId,
    {
      stage_number: priorRow.stage_number,
      patch: updates,
      reason: reason ?? null,
    },
  );

  // Return the fresh row via the view so the UI gets the recomputed
  // escalation_pct in the same response.
  const { data: fresh, error: freshErr } = await (
    supabase.from("stages_with_escalation") as any
  )
    .select(
      "id, stage_number, stage_label, rate_per_sqm, escalation_pct, is_open_for_registration, auto_advance_threshold_pct, public_visible, updated_at",
    )
    .eq("id", params.stageId)
    .single();

  if (freshErr) {
    return NextResponse.json({ error: freshErr.message }, { status: 500 });
  }

  return NextResponse.json({ stage: fresh });
}
