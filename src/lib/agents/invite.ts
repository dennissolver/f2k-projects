import crypto from "crypto";

/**
 * Agent invite tokens + codes.
 *
 * On "Create agent", Uwe generates a single-use invite:
 *   - a `token` that goes in the email's Activate link (?token=...),
 *   - a human `code` (XXXX-XXXX) shown in the email + admin for Uwe to relay.
 *
 * We never store the raw token/code — only their HMACs (keyed by
 * AGENT_INVITE_TOKEN_SECRET). On activation we recompute the HMACs and compare
 * in constant time. The link identifies the invite; the code is the gate; both
 * must match and the invite must be unexpired + still pending.
 */

const INVITE_TTL_DAYS = 14;
// Unambiguous alphabet — no 0/O/1/I/L to avoid transcription errors.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function secret(): string {
  const s = process.env.AGENT_INVITE_TOKEN_SECRET;
  if (!s) throw new Error("AGENT_INVITE_TOKEN_SECRET is not set");
  return s;
}

function hmac(value: string): string {
  return crypto.createHmac("sha256", secret()).update(value).digest("hex");
}

/** Normalise a user-typed code: strip separators/whitespace, uppercase. */
export function normalizeCode(code: string): string {
  return (code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export interface GeneratedInvite {
  token: string; // raw — goes in the Activate link
  code: string; // raw, formatted XXXX-XXXX — shown/emailed
  tokenHash: string; // store on agents.invite_token_hash
  codeHash: string; // store on agents.invite_code_hash
  expiresAt: string; // ISO — store on agents.invite_expires_at
}

export function generateInvite(): GeneratedInvite {
  const token = crypto.randomBytes(32).toString("base64url");
  const bytes = crypto.randomBytes(8);
  let raw = "";
  for (let i = 0; i < 8; i++) raw += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  const code = `${raw.slice(0, 4)}-${raw.slice(4)}`;
  const expiresAt = new Date(
    Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  return {
    token,
    code,
    tokenHash: hmac(token),
    codeHash: hmac(normalizeCode(code)),
    expiresAt,
  };
}

/** HMAC of a link token — used to look up the pending agent by invite_token_hash. */
export function hashToken(token: string): string {
  return hmac(token);
}

function timingSafeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

/** Constant-time check that a typed code matches the stored hash. */
export function verifyCode(inputCode: string, storedCodeHash: string): boolean {
  return timingSafeEqualHex(hmac(normalizeCode(inputCode)), storedCodeHash);
}

export function inviteExpired(expiresAtIso: string | null): boolean {
  if (!expiresAtIso) return true;
  return Date.now() > new Date(expiresAtIso).getTime();
}
