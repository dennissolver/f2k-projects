import crypto from "crypto";

/**
 * Agent attribution tokens (ROI portal, spec §4).
 *
 * Unlike the invite token/code (a single-use credential, stored only as an HMAC),
 * the attribution token is a PUBLIC referral tag — it travels in the agent's share
 * link `/r/<estate>?ref=TOKEN` and identifies the introducing agent so first-touch
 * attribution can be stamped. It is not a secret, so it is stored in plaintext on
 * `agents.attribution_token` with a unique index. It is opaque (random, not derived
 * from the agent) so other agents' tokens can't be guessed/enumerated.
 */

/** Generate an opaque, URL-safe attribution token (~16 chars). */
export function generateAttributionToken(): string {
  return crypto.randomBytes(12).toString("base64url");
}

/**
 * Public estate page for an estate slug. Convention in this app: `/<slug>-estate`
 * (e.g. branscombe -> /branscombe-estate, seafields -> /seafields-estate).
 */
export function estatePublicPath(estateSlug: string): string {
  return `/${estateSlug}-estate`;
}

/** The agent's shareable attribution link for a given estate. */
export function buildAgentLink(
  siteUrl: string,
  estateSlug: string,
  token: string,
): string {
  const base = siteUrl.replace(/\/$/, "");
  return `${base}/r/${estateSlug}?ref=${encodeURIComponent(token)}`;
}
