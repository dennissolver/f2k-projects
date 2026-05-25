import { NextResponse } from "next/server";
import { getAdminUser, hasPermission } from "@/lib/admin-auth";
import { createSupabaseServiceWithActor } from "@/lib/supabase-service";
import { getEstateBlog, estatePermission } from "@/lib/estates/blog-config";
import { buildUnsubscribeUrl, buildUnsubscribeApiUrl, renderPostEmailHtml, sendRawEmail } from "@/lib/estates/email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_PER_RUN = 200;
const WEEKLY_CAP = 2; // max emails per subscriber per rolling 7 days

interface RouteCtx {
  params: { estate: string; id: string };
}

export async function POST(request: Request, { params }: RouteCtx) {
  const cfg = getEstateBlog(params.estate);
  if (!cfg) return NextResponse.json({ error: "Unknown estate" }, { status: 404 });
  const admin = await getAdminUser();
  if (!admin || !hasPermission(admin.role, estatePermission(cfg.slug, "posts"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let mode: "test" | "live" = "test";
  try {
    const body = await request.json();
    if (body?.mode === "live") mode = "live";
  } catch {
    // default test
  }

  const supabase = createSupabaseServiceWithActor(admin.email, `email ${cfg.slug} post (${mode})`);

  // Load the post.
  const { data: post, error: postErr } = await (supabase.from(cfg.postsTable) as any)
    .select("id, slug, title, overview, hero_media_id, published_at, email_subject")
    .eq("id", params.id)
    .maybeSingle();
  if (postErr) return NextResponse.json({ error: postErr.message }, { status: 500 });
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });
  if (mode === "live" && !post.published_at) {
    return NextResponse.json({ error: "Publish the post before sending it to subscribers." }, { status: 400 });
  }

  // Hero image URL.
  let heroUrl: string | null = null;
  if (post.hero_media_id) {
    const { data: m } = await (supabase.from(cfg.mediaTable) as any)
      .select("public_url")
      .eq("id", post.hero_media_id)
      .maybeSingle();
    heroUrl = m?.public_url ?? null;
  }

  const canonical = (process.env.NEXT_PUBLIC_CANONICAL_URL ?? "").replace(/\/$/, "");
  const subject = (post.email_subject && String(post.email_subject).trim()) || post.title;
  const blogUrl = `${canonical}/blog/${cfg.slug}`;

  const buildHtml = (toEmail: string) =>
    renderPostEmailHtml({
      estateName: cfg.name,
      blogUrl,
      title: post.title,
      bodyMarkdown: post.overview,
      heroUrl,
      unsubscribeUrl: buildUnsubscribeUrl(cfg.slug, toEmail),
    });

  // ---- TEST: send only to the admin ----
  if (mode === "test") {
    const to = admin.email;
    const { id, error } = await sendRawEmail({
      to,
      subject: `[TEST] ${subject}`,
      html: buildHtml(to),
      unsubscribeUrl: buildUnsubscribeApiUrl(cfg.slug, to),
    });
    if (error) return NextResponse.json({ error: `Test send failed: ${error}` }, { status: 502 });
    await (supabase.from("estate_post_emails") as any).insert({
      estate: cfg.slug, post_id: post.id, email: to, resend_message_id: id, status: "test",
    });
    return NextResponse.json({ mode: "test", sent: 1, to });
  }

  // ---- LIVE: send to eligible subscribers ----
  const { data: subRows, error: subErr } = await (supabase.from(cfg.subscriberTable) as any)
    .select("email");
  if (subErr) return NextResponse.json({ error: `Subscriber lookup failed: ${subErr.message}` }, { status: 500 });

  const subscribers = Array.from(
    new Set(
      (subRows ?? [])
        .map((r: { email: string | null }) => (r.email ?? "").trim().toLowerCase())
        .filter((e: string) => e.includes("@")),
    ),
  ) as string[];

  const { data: optoutRows } = await (supabase.from("estate_email_optouts") as any)
    .select("email").eq("estate", cfg.slug);
  const optedOut = new Set((optoutRows ?? []).map((r: { email: string }) => r.email.toLowerCase()));

  const { data: alreadyRows } = await (supabase.from("estate_post_emails") as any)
    .select("email").eq("estate", cfg.slug).eq("post_id", post.id).eq("status", "sent");
  const alreadySent = new Set((alreadyRows ?? []).map((r: { email: string }) => r.email.toLowerCase()));

  // 2/week cap — count sends per email in the last 7 days.
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentRows } = await (supabase.from("estate_post_emails") as any)
    .select("email").eq("estate", cfg.slug).eq("status", "sent").gte("sent_at", since);
  const recentCount = new Map<string, number>();
  for (const r of (recentRows ?? []) as { email: string }[]) {
    const e = r.email.toLowerCase();
    recentCount.set(e, (recentCount.get(e) ?? 0) + 1);
  }

  const summary = { mode: "live", sent: 0, skipped_optout: 0, skipped_already: 0, skipped_cap: 0, failed: 0, remaining: 0, total_subscribers: subscribers.length };

  let processed = 0;
  for (const email of subscribers) {
    if (optedOut.has(email)) { summary.skipped_optout++; continue; }
    if (alreadySent.has(email)) { summary.skipped_already++; continue; }
    if ((recentCount.get(email) ?? 0) >= WEEKLY_CAP) { summary.skipped_cap++; continue; }
    if (processed >= MAX_PER_RUN) { summary.remaining++; continue; }

    const { id, error } = await sendRawEmail({
      to: email,
      subject,
      html: buildHtml(email),
      unsubscribeUrl: buildUnsubscribeApiUrl(cfg.slug, email),
    });
    if (error) {
      summary.failed++;
      await (supabase.from("estate_post_emails") as any).insert({
        estate: cfg.slug, post_id: post.id, email, status: "failed",
      }).then(() => {}, () => {});
      continue;
    }
    await (supabase.from("estate_post_emails") as any).insert({
      estate: cfg.slug, post_id: post.id, email, resend_message_id: id, status: "sent",
    });
    summary.sent++;
    processed++;
  }

  // Stamp first send time on the post.
  if (summary.sent > 0) {
    await (supabase.from(cfg.postsTable) as any)
      .update({ email_sent_at: new Date().toISOString(), email_subject: subject })
      .eq("id", post.id);
  }

  return NextResponse.json(summary);
}
