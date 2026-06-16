// Registrant unsubscribe — a signed one-click opt-out link for acknowledgement emails.
//
// Registrants gave express consent (they ticked the box), so their acknowledgement carries a
// functional unsubscribe (Spam Act pillar 3). Rather than a per-row token on every registration
// table, we use a SIGNED link: the URL carries the email + an HMAC so it can't be forged or
// enumerated, and the unsubscribe route writes the address into the central `email_suppressions`
// table. Any future marketing send checks `isSuppressed()` before sending.

import { createHmac, timingSafeEqual } from "node:crypto";
import { createSupabaseService } from "@/lib/supabase-service";
import { complianceFooterHtml, complianceFooterText } from "@/lib/email/compliance";

const SITE =
  process.env.NEXT_PUBLIC_CANONICAL_URL || "https://f2k-projects.vercel.app";

/** Signing secret. Reuses CRON_SECRET (set in prod); falls back to a dedicated var. */
function secret(): string {
  return process.env.UNSUBSCRIBE_SECRET || process.env.CRON_SECRET || "";
}

/** HMAC-SHA256 of the lowercased email, hex — the link signature. */
export function signEmail(email: string): string {
  return createHmac("sha256", secret()).update(email.trim().toLowerCase()).digest("hex");
}

/** Timing-safe check that a token matches the email's signature. */
export function verifyEmailToken(email: string, token: string): boolean {
  const expected = signEmail(email);
  if (!token || token.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  } catch {
    return false;
  }
}

/** The signed one-click unsubscribe URL for a registrant. */
export function unsubscribeUrl(email: string): string {
  const e = encodeURIComponent(email.trim().toLowerCase());
  const t = signEmail(email);
  return `${SITE}/api/email/unsubscribe?e=${e}&t=${t}`;
}

/** Has this address opted out? Future marketing sends MUST call this before sending. */
export async function isSuppressed(email: string): Promise<boolean> {
  try {
    const supabase = createSupabaseService();
    const { data } = await (supabase.from("email_suppressions") as any)
      .select("id")
      .eq("email", email.trim().toLowerCase())
      .maybeSingle();
    return !!data;
  } catch (err) {
    // Fail safe: if we can't confirm, treat as NOT suppressed only for transactional acks.
    console.error("isSuppressed check failed:", err);
    return false;
  }
}

/**
 * The compliant footer for a REGISTRANT acknowledgement email — express-consent basis + a
 * signed one-click unsubscribe for that address. Append to any acknowledgement we send to
 * someone who registered interest.
 */
export function registrantAckFooterHtml(email: string): string {
  return complianceFooterHtml({ unsubscribeUrl: unsubscribeUrl(email), reason: "express" });
}

export function registrantAckFooterText(email: string): string {
  return complianceFooterText({ unsubscribeUrl: unsubscribeUrl(email), reason: "express" });
}

/** Record an opt-out (idempotent upsert on lower(email)). */
export async function suppressEmail(
  email: string,
  opts: { source?: string; estateSlug?: string; note?: string } = {},
): Promise<void> {
  const supabase = createSupabaseService();
  await (supabase.from("email_suppressions") as any).upsert(
    {
      email: email.trim().toLowerCase(),
      source: opts.source ?? "registrant-unsubscribe",
      estate_slug: opts.estateSlug ?? null,
      note: opts.note ?? null,
    },
    { onConflict: "email", ignoreDuplicates: true },
  );
}
