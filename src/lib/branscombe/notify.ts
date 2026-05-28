/**
 * Branscombe notification helpers. Thin shim over @caistech/property-
 * launch-kit — pre-fills the Branscombe branding, recipient table name,
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
    supabase: createSupabaseService() as any,
    table: "branscombe_notify_recipients",
    fallback: FALLBACK_RECIPIENTS,
  });
}

export function renderBrandedEmail(args: RenderArgs): string {
  return renderBrandedEmailShared(args, BRANDING);
}

export const escapeHtml = escapeHtmlShared;
export const formatCurrency = formatCurrencyShared;
