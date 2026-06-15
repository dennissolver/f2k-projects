// Single source for the Seafields local-employer accommodation campaign email.
// Used by the campaign send route for BOTH the test send and the live send, so the
// email the operator reviews is byte-identical to what prospects receive.
//
// Dennis-signed; From the verified Resend sender, Reply-To Dennis. Spam-Act compliant:
// clear sender identification + a working one-click unsubscribe link.

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const CAMPAIGN_SUBJECT =
  "Local accommodation for your Geraldton team — Seafields, Waggrakine";

export const CAMPAIGN_FROM =
  "Factory2Key <noreply@updates.corporateaisolutions.com>";
export const CAMPAIGN_REPLY_TO = "dennis@factory2key.com.au";

export interface CampaignEmailArgs {
  businessName: string;
  registerUrl: string;
  unsubscribeUrl: string;
}

export function renderEmployerCampaignEmail({
  businessName,
  registerUrl,
  unsubscribeUrl,
}: CampaignEmailArgs): { subject: string; html: string; text: string } {
  const name = escapeHtml(businessName);

  const text = `Hi ${businessName},

I'm reaching out from Factory2Key. We're developing Seafields Estate at Waggrakine, just north of Geraldton — and part of it tackles a problem we hear constantly from local businesses: good workers, but nowhere local to house them, so roles end up fly-in/fly-out.

We're building accommodation so you can house staff locally. Two ways to use it:

- Reserve beds (take-or-pay) — commit to a set number of beds for a fixed term. Guaranteed accommodation for your team, without owning.
- Own it — buy a house-and-land package and use it for staff.

If either could take the FIFO headache off your plate, tell us what you'd need in about two minutes here:
${registerUrl}

It's a registration of interest only — no cost, no commitment.

Kind regards,
Dennis McMahon
Factory2Key
+61 402 612 471 | dennis@factory2key.com.au

Factory2Key · PO Box 1390, Upwey VIC 3158
You received this because your business is publicly listed in the Geraldton/Midwest trades. To opt out: ${unsubscribeUrl}`;

  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:600px;margin:0 auto;color:#1f2a37;">
  <div style="background:#142C44;padding:22px 28px;">
    <h1 style="color:#fff;margin:0;font-size:20px;">Factory2Key · Seafields Estate</h1>
    <p style="color:#C77F3A;margin:4px 0 0;font-size:13px;">Local employer accommodation — Waggrakine, Geraldton WA</p>
  </div>
  <div style="padding:28px;background:#ffffff;line-height:1.6;font-size:15px;">
    <p style="margin:0 0 14px;">Hi ${name},</p>
    <p style="margin:0 0 14px;">I'm reaching out from <strong>Factory2Key</strong>. We're developing <strong>Seafields Estate</strong> at Waggrakine, just north of Geraldton — and part of it tackles a problem we hear constantly from local businesses: good workers, but nowhere local to house them, so roles end up fly-in/fly-out.</p>
    <p style="margin:0 0 8px;">We're building accommodation so you can house staff <strong>locally</strong>. Two ways to use it:</p>
    <ul style="margin:0 0 16px;padding-left:20px;">
      <li style="margin-bottom:6px;"><strong>Reserve beds (take-or-pay)</strong> — commit to a set number of beds for a fixed term. Guaranteed accommodation for your team, without owning.</li>
      <li><strong>Own it</strong> — buy a house-and-land package and use it for staff.</li>
    </ul>
    <p style="margin:0 0 20px;">If either could take the FIFO headache off your plate, tell us what you'd need in about two minutes:</p>
    <p style="margin:0 0 22px;">
      <a href="${registerUrl}" style="display:inline-block;background:#1B3A5B;color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:4px;">Tell us what you'd need →</a>
    </p>
    <p style="margin:0 0 18px;color:#4A5568;font-size:14px;">It's a registration of interest only — no cost, no commitment.</p>
    <p style="margin:0;">Kind regards,<br><strong>Dennis McMahon</strong><br>Factory2Key<br>
      <a href="tel:+61402612471" style="color:#1B3A5B;">+61 402 612 471</a> &nbsp;|&nbsp;
      <a href="mailto:dennis@factory2key.com.au" style="color:#1B3A5B;">dennis@factory2key.com.au</a>
    </p>
  </div>
  <div style="background:#F5F3EE;padding:16px 28px;font-size:11px;color:#8a8a8a;line-height:1.5;">
    Factory2Key · PO Box 1390, Upwey VIC 3158. You received this because your business is publicly listed in the Geraldton/Midwest trades and this offer relates to housing your workers.
    <a href="${unsubscribeUrl}" style="color:#8a8a8a;text-decoration:underline;">Unsubscribe</a> and we won't email you again.
  </div>
</div>`;

  return { subject: CAMPAIGN_SUBJECT, html, text };
}
