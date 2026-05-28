/**
 * Seafields notification helpers. Thin shim over @caistech/property-
 * launch-kit — pre-fills the Seafields branding, recipient table name,
 * and Supabase client so callers don't have to repeat them.
 */

import {
  escapeHtml as escapeHtmlShared,
  formatCurrency as formatCurrencyShared,
  getActiveRecipients as getActiveRecipientsShared,
  renderBrandedEmail as renderBrandedEmailShared,
  type Branding,
  type RenderArgs,
} from "@caistech/property-launch-kit";
import { createSupabaseService } from "@/lib/supabase-service";

const BRANDING: Branding = {
  productName: "Seafields Estate",
  adminUrl:
    "https://f2k-projects.vercel.app/admin/seafields-registrations",
};

const FALLBACK_RECIPIENTS = [
  "dennis@factory2key.com.au",
  "uwe@factory2key.com.au",
];

const FIXED_RECIPIENTS = [
  "barryh@hld.com.au",
  "jthomson@jbccorp.com.au",
];

export async function getActiveRecipients(): Promise<string[]> {
  const dbRecipients = await getActiveRecipientsShared({
    supabase: createSupabaseService() as any,
    table: "seafields_notify_recipients",
    fallback: FALLBACK_RECIPIENTS,
  });
  return [...new Set([...dbRecipients, ...FIXED_RECIPIENTS])];
}

export function renderBrandedEmail(args: RenderArgs): string {
  return renderBrandedEmailShared(args, BRANDING);
}

export const escapeHtml = escapeHtmlShared;
export const formatCurrency = formatCurrencyShared;
