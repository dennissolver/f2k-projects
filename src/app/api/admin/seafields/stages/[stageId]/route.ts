import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAdminUser, hasPermission, auditLog } from "@/lib/admin-auth";
import {
  createSupabaseService,
  createSupabaseServiceWithActor,
} from "@/lib/supabase-service";
import { sendTemplated } from "@/lib/email/send";

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

  // Perform the update through an attributed client — x-actor-email +
  // x-audit-reason headers feed audit_entity_change() per migration 0008
  // so trigger rows carry full actor + reason.
  const attributed = createSupabaseServiceWithActor(admin.email, reason ?? null);
  const { error: updateErr } = await (attributed.from("stages") as any)
    .update(updates)
    .eq("id", params.stageId);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

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

  // F2KSFLDS-9: stage-opens-for-registration email fan-out. Fires only on
  // the false→true edge of is_open_for_registration. Notifies every active
  // primary registrant whose lot belongs to an EARLIER stage so they know
  // their locked rate is now below the new ladder rate. Best-effort —
  // never blocks the admin response.
  try {
    const opened =
      priorRow.is_open_for_registration === false &&
      updates.is_open_for_registration === true;
    if (opened) {
      const newStageNumber: number = fresh.stage_number;
      const newStageLabel: string = fresh.stage_label;

      // Earlier stages whose registrants get price-protected.
      const { data: earlierStages } = await (supabase.from("stages") as any)
        .select("id, stage_number, rate_per_sqm")
        .lt("stage_number", newStageNumber);

      const earlierStageById = new Map<
        string,
        { stage_number: number; rate_per_sqm: number | null }
      >(
        ((earlierStages as Array<{
          id: string;
          stage_number: number;
          rate_per_sqm: number | null;
        }> | null) || []).map((s) => [s.id, s]),
      );

      if (earlierStageById.size > 0) {
        const { data: rows } = await (
          supabase.from("seafields_registration_lots") as any
        )
          .select(
            "stage_at_registration_id, seafields_registrations!inner(first_name, email)",
          )
          .eq("status", "active")
          .eq("registration_type", "primary")
          .in(
            "stage_at_registration_id",
            Array.from(earlierStageById.keys()),
          );

        // De-dupe by email — one registrant might hold multiple lots on
        // the same earlier stage; send the stage-advance notice once.
        const seen = new Set<string>();
        let sent = 0;
        for (const row of (rows as Array<{
          stage_at_registration_id: string;
          seafields_registrations: { first_name: string; email: string };
        }> | null) ?? []) {
          const key = `${row.seafields_registrations.email}|${row.stage_at_registration_id}`;
          if (seen.has(key)) continue;
          seen.add(key);

          const lockedStage = earlierStageById.get(row.stage_at_registration_id);
          const lockedRate =
            lockedStage?.rate_per_sqm != null
              ? `$${Number(lockedStage.rate_per_sqm).toLocaleString()}`
              : "your registered rate";

          await sendTemplated({
            slug: "stage_advanced_notice",
            to: row.seafields_registrations.email,
            variables: {
              first_name: row.seafields_registrations.first_name,
              stage_number: newStageNumber,
              stage_label: newStageLabel,
              locked_rate: lockedRate,
            },
            audit: {
              actorEmail: admin.email,
              entityType: "stage",
              entityId: params.stageId,
            },
          });
          sent++;
        }
        await auditLog(
          admin.id,
          admin.email,
          "stage_advanced_notifications_sent",
          "stage",
          params.stageId,
          { stage_number: newStageNumber, count: sent },
        );
      }
    }
  } catch (err) {
    console.error("Stage-advance email fan-out threw:", err);
  }

  revalidatePath("/seafields-estate");
  revalidatePath("/");

  return NextResponse.json({ stage: fresh });
}
