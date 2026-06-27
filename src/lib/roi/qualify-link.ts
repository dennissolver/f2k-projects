import crypto from "crypto";

/**
 * Signed qualification-form link (ROI portal artefact 2).
 *
 * The covering email / nudge sends the buyer a one-click link to the pre-attributed,
 * pre-filled qualification form. The link carries the waitlist record id in a signed,
 * expiring token so it can't be tampered to point at a different buyer (which would
 * mis-attribute commission). Signed (not encrypted) — the id isn't secret, but it must
 * be tamper-evident.
 */

const TTL_DAYS = 30;
export const QUALIFY_LINK_TTL_SECONDS = TTL_DAYS * 24 * 60 * 60;

function secret(): string {
  const s =
    process.env.ATTRIBUTION_SECRET || process.env.AGENT_INVITE_TOKEN_SECRET;
  if (!s) throw new Error("ATTRIBUTION_SECRET / AGENT_INVITE_TOKEN_SECRET is not set");
  return s;
}

function sign(body: string): string {
  return crypto.createHmac("sha256", secret()).update(body).digest("base64url");
}

/** Signed, expiring token for a waitlist record. */
export function signQualifyToken(waitlistId: string): string {
  const body = Buffer.from(
    JSON.stringify({ w: waitlistId, ts: Date.now() }),
  ).toString("base64url");
  return `${body}.${sign(body)}`;
}

/** Verify + parse a qualify token. Returns the waitlist id, or null if tampered/expired. */
export function parseQualifyToken(token: string | undefined | null): { waitlistId: string } | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expected = sign(body);
  if (
    expected.length !== mac.length ||
    !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(mac))
  ) {
    return null;
  }
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!p || typeof p.w !== "string" || typeof p.ts !== "number") return null;
    if (Date.now() - p.ts > QUALIFY_LINK_TTL_SECONDS * 1000) return null;
    return { waitlistId: p.w };
  } catch {
    return null;
  }
}

/** The buyer-facing qualification link for an estate + waitlist record. */
export function buildQualifyUrl(
  siteUrl: string,
  estateSlug: string,
  waitlistId: string,
): string {
  const base = siteUrl.replace(/\/$/, "");
  return `${base}/${estateSlug}-estate/qualify?t=${encodeURIComponent(signQualifyToken(waitlistId))}`;
}
