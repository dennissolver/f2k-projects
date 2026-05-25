import { NextResponse } from "next/server";
import { getAdminUser, hasPermission } from "@/lib/admin-auth";
import { createSupabaseServiceWithActor } from "@/lib/supabase-service";
import { generatePostDraft, type PostGenInputMedia, type PostGenRecentPost } from "@/lib/hemp-homes/post-generator";

export const dynamic = "force-dynamic";
// LLM generation can take 15-40s; give it room (Vercel hobby caps at 60s,
// the project is on a plan that allows more — keep within 60 to be safe).
export const maxDuration = 60;

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (!admin || !hasPermission(admin.role, "manage_hemp_homes_posts")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let postPrompt: string | null = null;
  try {
    const body = await request.json();
    if (typeof body?.post_prompt === "string") postPrompt = body.post_prompt;
  } catch {
    // No body — fine.
  }

  const supabase = createSupabaseServiceWithActor(admin.email, "AI-draft hemp-homes post");

  const { data: settingRow } = await (supabase.from("estate_blog_settings") as any)
    .select("ai_context")
    .eq("estate", "hemp-homes")
    .maybeSingle();
  const estateContext: string | null = settingRow?.ai_context ?? null;

  // Photo pool: curated (shown in gallery) OR captioned — the vetted set the
  // LLM can ground a post in. Uncaptioned raw dumps are excluded as noise.
  const { data: mediaRows, error: mediaErr } = await (supabase.from("hemp_homes_media") as any)
    .select("id, kind, caption, alt_text")
    .or("show_in_gallery.eq.true,caption.not.is.null")
    .order("created_at", { ascending: false })
    .limit(40);
  if (mediaErr) {
    return NextResponse.json({ error: `Media lookup failed: ${mediaErr.message}` }, { status: 500 });
  }

  // Recent posts for dedup/variety.
  const { data: recentRows, error: recentErr } = await (supabase.from("hemp_homes_posts") as any)
    .select("title, stage")
    .order("created_at", { ascending: false })
    .limit(8);
  if (recentErr) {
    return NextResponse.json({ error: `Post lookup failed: ${recentErr.message}` }, { status: 500 });
  }

  const photos: PostGenInputMedia[] = (mediaRows ?? []).map((m: any) => ({
    id: m.id,
    kind: m.kind,
    caption: m.caption,
    alt_text: m.alt_text,
  }));
  const recentPosts: PostGenRecentPost[] = (recentRows ?? []).map((r: any) => ({
    title: r.title,
    stage: r.stage,
  }));

  let draft;
  try {
    draft = await generatePostDraft(photos, recentPosts, { estateContext, postPrompt });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }

  const slug = `${slugify(draft.title)}-${Date.now().toString(36)}`;
  const heroMediaId = draft.media_ids[0] ?? null;

  // Insert the DRAFT (published_at stays null — never auto-publish).
  const { data: post, error: insErr } = await (supabase.from("hemp_homes_posts") as any)
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

  if (insErr) {
    return NextResponse.json({ error: `Draft insert failed: ${insErr.message}` }, { status: 500 });
  }

  // Attach the selected photos (best-effort — the post already exists).
  if (draft.media_ids.length > 0) {
    const links = draft.media_ids.map((media_id, i) => ({
      post_id: post.id,
      media_id,
      sort_order: i,
    }));
    const { error: linkErr } = await (supabase.from("hemp_homes_post_media") as any).insert(links);
    if (linkErr) {
      // Non-fatal: the draft is usable; the operator can re-attach in the editor.
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
