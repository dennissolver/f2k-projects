/**
 * Hemp Homes notification helpers. Thin shim over @caistech/property-
 * launch-kit — pre-fills the Hemp Homes branding, recipient table name,
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
  productName: "Hemp Homes",
  adminUrl: "https://f2k-projects.vercel.app/admin/hemp-homes",
  // Forest accent matching DESIGN.md §11 — distinct from F2K's teal.
  palette: { accent: "#1B4332" },
};

const FALLBACK_RECIPIENTS = [
  "dennis@factory2key.com.au",
  "uwe@factory2key.com.au",
  "steve@wandarra.com.au",
];

export async function getActiveRecipients(): Promise<string[]> {
  return getActiveRecipientsShared({
    supabase: createSupabaseService() as any,
    table: "hemp_homes_notify_recipients",
    fallback: FALLBACK_RECIPIENTS,
  });
}

export function renderBrandedEmail(args: RenderArgs): string {
  return renderBrandedEmailShared(args, BRANDING);
}

export const escapeHtml = escapeHtmlShared;
export const formatCurrency = formatCurrencyShared;
