// Australian Spam Act 2003 email compliance for Factory2Key.
//
// Thin binding over the shared @caistech/email-compliance package (the portfolio-wide
// implementation) — this module just fixes the Factory2Key sender identity so the rest of the
// repo calls the footer/guard helpers without repeating the ABN/postal each time. Do NOT re-fork
// the footer logic here; extend the shared package instead.

import {
  complianceFooterHtml as _footerHtml,
  complianceFooterText as _footerText,
  assertCompliant as _assertCompliant,
  identificationLine,
  assertJurisdictionAllowed,
  SUPPORTED_OUTREACH_JURISDICTIONS,
  type SenderIdentity,
  type ComplianceFooterArgs,
  type Jurisdiction,
} from "@caistech/email-compliance";

/** Factory2Key's legally-identifying sender details (Spam Act pillar 2). */
export const FACTORY2KEY: SenderIdentity = {
  name: "Factory2Key",
  abn: "51 700 805 298",
  postal: "PO Box 1390, Upwey VIC 3158",
  email: "dennis@factory2key.com.au",
  phone: "+61 402 612 471",
};

/** The single-line Factory2Key identification, reused in HTML + text. */
export const IDENTIFICATION_LINE = identificationLine(FACTORY2KEY);

type BoundFooterArgs = Omit<ComplianceFooterArgs, "sender">;

/** Compliance footer (HTML) bound to the Factory2Key sender. */
export function complianceFooterHtml(args: BoundFooterArgs): string {
  return _footerHtml({ ...args, sender: FACTORY2KEY });
}

/** Compliance footer (plain text) bound to the Factory2Key sender. */
export function complianceFooterText(args: BoundFooterArgs): string {
  return _footerText({ ...args, sender: FACTORY2KEY });
}

/** Guard a Factory2Key commercial send (Spam Act + non-AU jurisdiction block). */
export function assertCompliant(
  args: BoundFooterArgs & {
    commercial?: boolean;
    recipientCountry?: Jurisdiction;
    supportedJurisdictions?: readonly string[];
  },
): void {
  _assertCompliant({ ...args, sender: FACTORY2KEY });
}

export { assertJurisdictionAllowed, SUPPORTED_OUTREACH_JURISDICTIONS };
