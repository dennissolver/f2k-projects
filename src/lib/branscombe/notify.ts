/**
 * Branscombe notification helpers. Thin shim over the generic
 * property-launch-kit — pre-fills the Branscombe branding and recipient
 * table name so callers don't have to repeat them.
 */

import {
  escapeHtml as escapeHtmlShared,
  formatCurrency as formatCurrencyShared,
  getActiveRecipients as getActiveRecipientsShared,
  renderBrandedEmail as renderBrandedEmailShared,
  type Branding,
  type RenderArgs,
} from "@/lib/property-launch-kit";

const BRANDING: Branding = {
  productName: "Branscombe Estate",
  adminUrl: "https://f2k-projects.vercel.app/admin/branscombe-pipeline",
};

const FALLBACK_RECIPIENTS = [
  "dennis@factory2key.com.au",
  "uwe@factory2key.com.au",
  "barrbuilders@bigpond.com",
];

export async function getActiveRecipients(): Promise<string[]> {
  return getActiveRecipientsShared({
    table: "branscombe_notify_recipients",
    fallback: FALLBACK_RECIPIENTS,
  });
}

export function renderBrandedEmail(args: RenderArgs): string {
  return renderBrandedEmailShared(args, BRANDING);
}

export const escapeHtml = escapeHtmlShared;
export const formatCurrency = formatCurrencyShared;
