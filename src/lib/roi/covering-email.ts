import { escapeHtml } from "@/lib/html-escape";
import { registrantAckFooterHtml } from "@/lib/email/unsubscribe";

/**
 * The agent-branded covering email that delivers the qualification-form link (spec §3).
 * Used by the admin "Send qualification form" action and (re-implemented) by the 48h
 * auto-nudge edge function. Carries the Spam Act footer + unsubscribe.
 */
export function buildCoveringEmail(opts: {
  buyerName: string;
  buyerEmail: string;
  estateName: string;
  qualifyUrl: string;
  agentName: string | null;
  agentPhone: string | null;
  isNudge?: boolean;
}): { subject: string; html: string } {
  const name = escapeHtml(opts.buyerName || "there");
  const estate = escapeHtml(opts.estateName);
  const agent = opts.agentName ? escapeHtml(opts.agentName) : null;
  const phone = opts.agentPhone ? escapeHtml(opts.agentPhone) : null;

  const subject = opts.isNudge
    ? `Still interested in ${opts.estateName}?`
    : `Your ${opts.estateName} home — let's lock in your preference`;

  const intro = opts.isNudge
    ? `You registered interest in ${estate}. When you're ready, you can note your preferred home(s) here — no obligation.`
    : `Great speaking with you. To register your preferred home(s) and indicative terms — no obligation, no deposit — just complete this short form. It takes about two minutes.`;

  const agentLine = agent
    ? `<p style="font-size:14px;color:#4A5568;line-height:1.6">Your agent ${agent}${phone ? ` is on <a href="tel:${phone}" style="color:#00B5AD">${phone}</a>` : ""} if you'd like to talk it through.</p>`
    : "";

  const html = `
    <div style="max-width:600px;font-family:sans-serif">
      <div style="background:#1A2744;padding:24px 32px">
        <h1 style="color:#FFFFFF;margin:0;font-size:24px">${estate}</h1>
        <p style="color:#00B5AD;margin:4px 0 0;font-size:13px">A Factory2Key Development</p>
      </div>
      <div style="padding:32px;background:#FFFFFF">
        <p style="font-size:16px;color:#1A2744">Hi ${name},</p>
        <p style="font-size:14px;color:#4A5568;line-height:1.6">${intro}</p>
        <p style="margin:24px 0">
          <a href="${opts.qualifyUrl}" style="background:#00B5AD;color:#FFFFFF;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;font-size:15px;display:inline-block">
            Complete my registration →
          </a>
        </p>
        ${agentLine}
        <p style="font-size:13px;color:#94A3B8;line-height:1.6;margin-top:16px">
          Expression of interest only — no deposit, no obligation, nothing binding until a contract is signed.
        </p>
      </div>
      ${registrantAckFooterHtml(opts.buyerEmail)}
    </div>
  `;

  return { subject, html };
}
