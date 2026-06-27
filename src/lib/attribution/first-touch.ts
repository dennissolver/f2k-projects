import crypto from "crypto";

/**
 * First-touch attribution cookie (ROI portal, spec §4).
 *
 * When a buyer arrives via an agent's `/r/<estate>?ref=TOKEN` link, the resolver
 * stamps a signed, HttpOnly cookie capturing WHO introduced them and WHEN. Phase 2's
 * waitlist form reads this cookie and writes introducing_agent_id / introducing_agency_id /
 * first_touch_at onto the registration row (where migration 0063's trigger then makes them
 * immutable).
 *
 * The payload drives commission attribution, so it is HMAC-signed (tamper-evident) and
 * HttpOnly (not readable/forgeable from page JS). "First-touch wins": the resolver never
 * overwrites a valid existing cookie for the same estate — the original agent and timestamp
 * are preserved.
 *
 * One cookie per estate (`f2k_ft_<estate>`) so a buyer can be introduced to different estates
 * by different agents without collision.
 */

const COOKIE_PREFIX = "f2k_ft_";
/** Attribution window. A first touch is honoured for this long. */
export const FIRST_TOUCH_MAX_AGE_SECONDS = 90 * 24 * 60 * 60; // 90 days

export interface FirstTouch {
  estate: string;
  agentId: string;
  agencyId: string | null;
  token: string;
  /** ISO timestamp of the first touch (epoch ms is carried in the signed blob). */
  firstTouchAt: string;
}

export function firstTouchCookieName(estateSlug: string): string {
  return `${COOKIE_PREFIX}${estateSlug}`;
}

function secret(): string {
  // Reuse the existing agent-invite secret so Phase 1 adds no new required env var.
  // A dedicated ATTRIBUTION_SECRET overrides it when present.
  const s =
    process.env.ATTRIBUTION_SECRET || process.env.AGENT_INVITE_TOKEN_SECRET;
  if (!s) throw new Error("ATTRIBUTION_SECRET / AGENT_INVITE_TOKEN_SECRET is not set");
  return s;
}

function sign(body: string): string {
  return crypto.createHmac("sha256", secret()).update(body).digest("base64url");
}

/** Serialise + sign a first-touch payload for the cookie value. */
export function signFirstTouch(ft: FirstTouch): string {
  const payload = {
    e: ft.estate,
    a: ft.agentId,
    g: ft.agencyId,
    t: ft.token,
    ts: new Date(ft.firstTouchAt).getTime(),
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

/** Verify + parse a cookie value. Returns null if missing, tampered, or expired. */
export function parseFirstTouch(cookieValue: string | undefined | null): FirstTouch | null {
  if (!cookieValue) return null;
  const dot = cookieValue.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = cookieValue.slice(0, dot);
  const mac = cookieValue.slice(dot + 1);

  const expected = sign(body);
  // Constant-time compare; lengths must match first.
  if (
    expected.length !== mac.length ||
    !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(mac))
  ) {
    return null;
  }

  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!p || typeof p.e !== "string" || typeof p.a !== "string" || typeof p.ts !== "number") {
      return null;
    }
    // Honour the attribution window.
    if (Date.now() - p.ts > FIRST_TOUCH_MAX_AGE_SECONDS * 1000) return null;
    return {
      estate: p.e,
      agentId: p.a,
      agencyId: p.g ?? null,
      token: typeof p.t === "string" ? p.t : "",
      firstTouchAt: new Date(p.ts).toISOString(),
    };
  } catch {
    return null;
  }
}
