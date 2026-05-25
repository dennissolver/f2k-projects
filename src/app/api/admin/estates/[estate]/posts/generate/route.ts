import { NextResponse } from "next/server";
import { getAdminUser, hasPermission } from "@/lib/admin-auth";
import { createSupabaseServiceWithActor } from "@/lib/supabase-service";
import { getEstateBlog, estatePermission } from "@/lib/estates/blog-config";
import {
  generateEstatePostDraft,
  type PostGenInputMedia,
  type PostGenRecentPost,
} from "@/lib/hemp-homes/post-generator";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface RouteCtx {
  params: { estate: string };
}

function slugify(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

export async function POST(request: Request, { params }: RouteCtx) {
  const cfg = getEstateBlog(params.estate);
  if (!cfg) return NextResponse.json({ error: "Unknown estate" }, { status: 404 });
  const admin = await getAdminUser();
  if (!admin || !hasPermission(admin.role, estatePermission(cfg.slug, "posts"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let postPrompt: string | null = null;
  try {
    const body = await request.json();
    if (typeof body?.post_prompt === "string") postPrompt = body.post_prompt;
  } catch {
    // No body — fine.
  }

  const supabase = createSupabaseServiceWithActor(admin.email, `AI-draft ${cfg.slug} post`);

  const { data: settingRow } = await (supabase.from("estate_blog_settings") as any)
    .select("ai_context")
    .eq("estate", cfg.slug)
    .maybeSingle();
  const estateContext: string | null = settingRow?.ai_context ?? null;

  const { data: mediaRows, error: mediaErr } = await (supabase.from(cfg.mediaTable) as any)
    .select("id, kind, caption, alt_text")
    .or("show_in_gallery.eq.true,caption.not.is.null")
    .order("created_at", { ascending: false })
    .limit(40);
  if (mediaErr) return NextResponse.json({ error: `Media lookup failed: ${mediaErr.message}` }, { status: 500 });

  const { data: recentRows, error: recentErr } = await (supabase.from(cfg.postsTable) as any)
    .select("title, stage")
    .order("created_at", { ascending: false })
    .limit(8);
  if (recentErr) return NextResponse.json({ error: `Post lookup failed: ${recentErr.message}` }, { status: 500 });

  const photos: PostGenInputMedia[] = (mediaRows ?? []).map((m: any) => ({
    id: m.id, kind: m.kind, caption: m.caption, alt_text: m.alt_text,
  }));
  const recentPosts: PostGenRecentPost[] = (recentRows ?? []).map((r: any) => ({
    title: r.title, stage: r.stage,
  }));

  let draft;
  try {
    draft = await generateEstatePostDraft(cfg.name, cfg.aiContext, photos, recentPosts, {
      estateContext,
      postPrompt,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }

  const slug = `${slugify(draft.title)}-${Date.now().toString(36)}`;
  const heroMediaId = draft.media_ids[0] ?? null;

  const { data: post, error: insErr } = await (supabase.from(cfg.postsTable) as any)
    .insert({
      slug,
      title: draft.title,
      overview: draft.overview,
      stage: draft.stage,
      state: draft.state,
      hero_media_id: heroMediaId,
      created_by: admin.auth_user_id,
    })
    .select("id, slug, title, overview, stage, state, hero_media_id, published_at, email_sent_at, created_at, updated_at")
    .single();
  if (insErr) return NextResponse.json({ error: `Draft insert failed: ${insErr.message}` }, { status: 500 });

  if (draft.media_ids.length > 0) {
    const links = draft.media_ids.map((media_id, i) => ({ post_id: post.id, media_id, sort_order: i }));
    const { error: linkErr } = await (supabase.from(cfg.postMediaTable) as any).insert(links);
    if (linkErr) {
      return NextResponse.json({
        post,
        warning: `Draft created, but attaching photos failed: ${linkErr.message}`,
        selected_media: draft.media_ids.length,
      });
    }
  }

  return NextResponse.json({
    post,
    selected_media: draft.media_ids.length,
    llm: { model: draft.llm_model, input_tokens: draft.llm_input_tokens, output_tokens: draft.llm_output_tokens },
  }, { status: 201 });
}
