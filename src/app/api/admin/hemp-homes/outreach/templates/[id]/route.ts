import { NextResponse } from "next/server";
import { getAdminUser, hasPermission } from "@/lib/admin-auth";
import { createSupabaseServiceWithActor } from "@/lib/supabase-service";

export const dynamic = "force-dynamic";

const ALLOWED_TRIGGER_TYPES = new Set(["stage_transition", "time_gap", "manual"]);

interface Ctx { params: { id: string } }

export async function PATCH(request: Request, { params }: Ctx) {
  const admin = await getAdminUser();
  if (!admin || !hasPermission(admin.role, "manage_hemp_homes_outreach")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const update: Record<string, unknown> = {};
  const fields = [
    "name", "description", "subject_template", "preview_template",
    "body_md_template", "llm_instruction",
  ];
  for (const f of fields) {
    if (f in body) update[f] = body[f] === "" ? null : body[f];
  }
  if ("trigger_type" in body) {
    if (!ALLOWED_TRIGGER_TYPES.has(body.trigger_type)) {
      return NextResponse.json({ error: "Invalid trigger_type" }, { status: 400 });
    }
    update.trigger_type = body.trigger_type;
  }
  if ("trigger_config" in body) update.trigger_config = body.trigger_config ?? {};
  if ("target_waves" in body) update.target_waves = body.target_waves ?? null;
  if ("target_statuses" in body) update.target_statuses = body.target_statuses ?? null;
  if ("target_states" in body) update.target_states = body.target_states ?? null;
  if ("active" in body) update.active = !!body.active;
  if ("auto_send" in body) update.auto_send = !!body.auto_send;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const supabase = createSupabaseServiceWithActor(admin.email, "edit hemp-homes outreach template");
  const { data, error } = await (supabase.from("hemp_homes_outreach_templates") as any)
    .update(update)
    .eq("id", params.id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ template: data });
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const admin = await getAdminUser();
  if (!admin || !hasPermission(admin.role, "manage_hemp_homes_outreach")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const supabase = createSupabaseServiceWithActor(admin.email, "delete hemp-homes outreach template");
  const { error } = await (supabase.from("hemp_homes_outreach_templates") as any)
    .delete()
    .eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
