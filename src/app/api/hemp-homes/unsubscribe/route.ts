/**
 * Public unsubscribe endpoint. Handles BOTH:
 *  - GET  /api/hemp-homes/unsubscribe?t=<token>  (link click from email)
 *  - POST /api/hemp-homes/unsubscribe            (RFC 8058 one-click,
 *      triggered by Gmail/Apple Mail via List-Unsubscribe-Post header)
 *
 * Both paths verify the HMAC token, set outreach_status='declined' +
 * unsubscribed_at on the prospect (idempotent — re-unsub is a no-op),
 * write an audit_log row, then GET redirects to the public confirmation
 * page while POST returns a 200.
 *
 * No login. The token IS the authentication. Spam Act 2003 forbids
 * requiring auth on the unsubscribe path.
 */

import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createSupabaseService } from "@/lib/supabase-service";
import { verifyUnsubscribeToken } from "@/lib/hemp-homes/unsubscribe-token";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function hashIp(ip: string | null, salt: string | undefined): string | null {
  if (!ip || !salt) return null;
  return createHash("sha256").update(`${ip}${salt}`).digest("hex");
}

function getClientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() ?? null;
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return null;
}

function canonicalUrl(): string {
  return (process.env.NEXT_PUBLIC_CANONICAL_URL ?? "").replace(/\/$/, "");
}

async function performUnsubscribe(token: string, req: Request): Promise<{ ok: boolean; reason?: string; prospect_name?: string }> {
  const verified = verifyUnsubscribeToken(token);
  if (!verified) return { ok: false, reason: "Invalid or tampered unsubscribe link." };

  const supabase = createSupabaseService();
  const ipHash = hashIp(getClientIp(req), process.env.IP_HASH_SALT);

  const { data: prospect, error } = await (supabase
    .from("hemp_homes_community_prospects") as any)
    .update({
      outreach_status: "declined",
      unsubscribed_at: new Date().toISOString(),
      unsubscribed_ip_hash: ipHash,
    })
    .eq("id", verified.prospectId)
    .select("id, name, outreach_status")
    .maybeSingle();

  if (error) {
    return { ok: false, reason: error.message };
  }
  if (!prospect) {
    return { ok: false, reason: "Community not found." };
  }

  // Audit
  await supabase.from("audit_log").insert({
    actor_id: null,
    actor_email: null,
    action: "hemp_homes_outreach_unsubscribed",
    entity_type: "hemp_homes_community_prospects",
    entity_id: prospect.id,
    details: {
      prospect_name: prospect.name,
      via: "public-unsubscribe-link",
      ip_hash: ipHash,
    },
  }).then(() => {}, (err: unknown) => console.error("audit insert failed", err));

  return { ok: true, prospect_name: prospect.name };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("t");
  if (!token) {
    return NextResponse.redirect(`${canonicalUrl()}/hemp-homes/unsubscribe?error=missing_token`);
  }

  const result = await performUnsubscribe(token, request);
  const target = result.ok
    ? `${canonicalUrl()}/hemp-homes/unsubscribe?status=ok&community=${encodeURIComponent(result.prospect_name ?? "")}`
    : `${canonicalUrl()}/hemp-homes/unsubscribe?error=${encodeURIComponent(result.reason ?? "failed")}`;
  return NextResponse.redirect(target);
}

// RFC 8058 — Gmail/Apple Mail call POST with no body when the user hits
// the native Unsubscribe button. Must respond 200 quickly and not require
// any form input.
export async function POST(request: Request) {
  const url = new URL(request.url);
  let token = url.searchParams.get("t");
  if (!token) {
    // Some clients send the token in the body as form-encoded.
    try {
      const body = await request.text();
      const params = new URLSearchParams(body);
      token = params.get("t");
    } catch {
      // ignore
    }
  }
  if (!token) {
    return NextResponse.json({ error: "missing token" }, { status: 400 });
  }
  const result = await performUnsubscribe(token, request);
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
