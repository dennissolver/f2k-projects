import { NextResponse } from "next/server";
import { getAdminUser, hasPermission } from "@/lib/admin-auth";
import { createSupabaseService, createSupabaseServiceWithActor } from "@/lib/supabase-service";
import { getEstateBlog, estatePermission } from "@/lib/estates/blog-config";

export const dynamic = "force-dynamic";

interface RouteCtx {
  params: { estate: string };
}

// Persisted per-estate "system" context for the AI blog drafter. Works for all
// estates (hemp-homes included) keyed by slug.
export async function GET(_request: Request, { params }: RouteCtx) {
  const cfg = getEstateBlog(params.estate);
  if (!cfg) return NextResponse.json({ error: "Unknown estate" }, { status: 404 });
  const admin = await getAdminUser();
  if (!admin || !hasPermission(admin.role, estatePermission(cfg.slug, "posts"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createSupabaseService();
  const { data, error } = await (supabase.from("estate_blog_settings") as any)
    .select("ai_context, updated_at")
    .eq("estate", cfg.slug)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ai_context: data?.ai_context ?? "", updated_at: data?.updated_at ?? null });
}

export async function PUT(request: Request, { params }: RouteCtx) {
  const cfg = getEstateBlog(params.estate);
  if (!cfg) return NextResponse.json({ error: "Unknown estate" }, { status: 404 });
  const admin = await getAdminUser();
  if (!admin || !hasPermission(admin.role, estatePermission(cfg.slug, "posts"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const ai_context = body.ai_context == null ? null : String(body.ai_context).trim() || null;

  const supabase = createSupabaseServiceWithActor(admin.email, `set ${cfg.slug} blog context`);
  const { error } = await (supabase.from("estate_blog_settings") as any)
    .upsert({ estate: cfg.slug, ai_context }, { onConflict: "estate" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, ai_context: ai_context ?? "" });
}
