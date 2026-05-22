import { NextResponse } from "next/server";
import { getAdminUser, hasPermission } from "@/lib/admin-auth";
import {
  createSupabaseService,
  createSupabaseServiceWithActor,
} from "@/lib/supabase-service";

export const dynamic = "force-dynamic";

const ALLOWED_TRIGGER_TYPES = new Set(["stage_transition", "time_gap", "manual"]);

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100);
}

export async function GET() {
  const admin = await getAdminUser();
  if (!admin || !hasPermission(admin.role, "manage_hemp_homes_outreach")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const supabase = createSupabaseService();
  const { data, error } = await (supabase.from("hemp_homes_outreach_templates") as any)
    .select("*")
    .order("active", { ascending: false })
    .order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ templates: data ?? [] });
}

export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (!admin || !hasPermission(admin.role, "manage_hemp_homes_outreach")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  const triggerType = String(body.trigger_type ?? "manual");
  if (!ALLOWED_TRIGGER_TYPES.has(triggerType)) {
    return NextResponse.json({ error: "Invalid trigger_type" }, { status: 400 });
  }
  const subject = String(body.subject_template ?? "").trim();
  const bodyMd = String(body.body_md_template ?? "").trim();
  if (!subject) return NextResponse.json({ error: "subject_template required" }, { status: 400 });
  if (!bodyMd) return NextResponse.json({ error: "body_md_template required" }, { status: 400 });

  const slug = body.slug ? slugify(body.slug) : `${slugify(name)}-${Date.now().toString(36)}`;

  const supabase = createSupabaseServiceWithActor(admin.email, "create hemp-homes outreach template");
  const { data, error } = await (supabase.from("hemp_homes_outreach_templates") as any)
    .insert({
      slug,
      name,
      description: body.description ?? null,
      trigger_type: triggerType,
      trigger_config: body.trigger_config ?? {},
      target_waves: body.target_waves ?? null,
      target_statuses: body.target_statuses ?? null,
      target_states: body.target_states ?? null,
      subject_template: subject,
      preview_template: body.preview_template ?? null,
      body_md_template: bodyMd,
      llm_instruction: body.llm_instruction ?? null,
      active: body.active ?? true,
      auto_send: false, // Phase 1: never auto-send on create
      created_by: admin.auth_user_id,
    })
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Slug already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ template: data }, { status: 201 });
}
