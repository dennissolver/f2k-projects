/**
 * Estate blog-post email: unsubscribe tokens, post → HTML email, raw Resend send.
 *
 * Reuses HEMP_HOMES_UNSUBSCRIBE_SECRET as the HMAC key (it's just a signing key;
 * the name is incidental now that it covers all estates). Unsubscribe links are
 * required to work without login (Spam Act 2003) and never expire.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { renderMarkdown } from "@/lib/markdown";

function getSecret(): string {
  const s = process.env.HEMP_HOMES_UNSUBSCRIBE_SECRET;
  if (!s) throw new Error("HEMP_HOMES_UNSUBSCRIBE_SECRET is not set");
  return s;
}

function hmac(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

// token = base64url("estate:email") . hmac(payload)
export function signUnsubscribeToken(estate: string, email: string): string {
  const payload = Buffer.from(`${estate}:${email}`, "utf-8").toString("base64url");
  return `${payload}.${hmac(payload)}`;
}

export function verifyUnsubscribeToken(token: string): { estate: string; email: string } | null {
  if (typeof token !== "string") return null;
  const idx = token.lastIndexOf(".");
  if (idx === -1) return null;
  const payload = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  if (!payload || !sig) return null;
  const expected = hmac(payload);
  if (expected.length !== sig.length) return null;
  try {
    if (!timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
  } catch {
    return null;
  }
  const decoded = Buffer.from(payload, "base64url").toString("utf-8");
  const sep = decoded.indexOf(":");
  if (sep === -1) return null;
  const estate = decoded.slice(0, sep);
  const email = decoded.slice(sep + 1);
  if (!estate || !email) return null;
  return { estate, email };
}

// Human-facing confirm page (used in the email body).
export function buildUnsubscribeUrl(estate: string, email: string): string {
  const base = (process.env.NEXT_PUBLIC_CANONICAL_URL ?? "").replace(/\/$/, "");
  return `${base}/estates/unsubscribe?t=${encodeURIComponent(signUnsubscribeToken(estate, email))}`;
}

// One-click endpoint for the List-Unsubscribe header (mailbox providers POST here).
export function buildUnsubscribeApiUrl(estate: string, email: string): string {
  const base = (process.env.NEXT_PUBLIC_CANONICAL_URL ?? "").replace(/\/$/, "");
  return `${base}/api/estates/unsubscribe?t=${encodeURIComponent(signUnsubscribeToken(estate, email))}`;
}

export interface PostEmailData {
  estateName: string;
  blogUrl: string;
  title: string;
  bodyMarkdown: string;
  heroUrl: string | null;
  unsubscribeUrl: string;
}

// Thumbnail transform (smaller image in the email body).
function thumb(url: string): string {
  if (!url.includes("/storage/v1/object/public/")) return url;
  return url.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/") + "?width=1000&quality=72";
}

export function renderPostEmailHtml(d: PostEmailData): string {
  const body = renderMarkdown(d.bodyMarkdown);
  const hero = d.heroUrl
    ? `<img src="${thumb(d.heroUrl)}" alt="" style="width:100%;max-width:560px;height:auto;border-radius:6px;margin:0 0 20px;" />`
    : "";
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#1f2937;line-height:1.55;">
  <p style="font-size:12px;letter-spacing:0.15em;text-transform:uppercase;color:#6b7280;margin:0 0 8px;">${d.estateName} — Build Journal</p>
  <h1 style="font-size:24px;line-height:1.25;color:#0f172a;margin:0 0 16px;">${escape(d.title)}</h1>
  ${hero}
  <div style="font-size:16px;">${body}</div>
  <p style="margin:24px 0 0;"><a href="${d.blogUrl}" style="color:#1B4332;font-weight:600;">Read it on the website →</a></p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0 14px;" />
  <p style="font-size:12px;color:#9ca3af;margin:0;">
    You're receiving this because you registered interest in ${d.estateName}.
    <a href="${d.unsubscribeUrl}" style="color:#9ca3af;">Unsubscribe</a>.
  </p>
</div>`;
}

function escape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function sendRawEmail(args: {
  to: string;
  subject: string;
  html: string;
  unsubscribeUrl: string;
}): Promise<{ id: string | null; error: string | null }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { id: null, error: "RESEND_API_KEY not configured" };
  const from =
    process.env.RESEND_FROM_EMAIL || "Factory2Key <noreply@updates.corporateaisolutions.com>";
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    const res = await resend.emails.send({
      from,
      to: args.to,
      subject: args.subject,
      html: args.html,
      // List-Unsubscribe so Gmail/Outlook show a native unsubscribe control.
      headers: {
        "List-Unsubscribe": `<${args.unsubscribeUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });
    if (res.error) return { id: null, error: res.error.message ?? String(res.error) };
    return { id: res.data?.id ?? null, error: null };
  } catch (e) {
    return { id: null, error: e instanceof Error ? e.message : "Resend send threw" };
  }
}
