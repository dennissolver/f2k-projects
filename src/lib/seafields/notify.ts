/**
 * Seafields notification dispatcher. Centralises the recipient lookup and
 * branded HTML email rendering for the events Uwe + Dennis + Barry want
 * visibility on: new registrations, lot changes, and the daily digest.
 *
 * Recipients come from the seafields_notify_recipients table (managed via
 * /admin/seafields-registrations). If the table is empty or the lookup
 * fails, falls back to a hardcoded base of Dennis + Uwe + Barry so a
 * misconfigured DB never strands the whole notification path.
 */

import { createSupabaseService } from "@/lib/supabase-service";

const FALLBACK_RECIPIENTS = [
  "dennis@factory2key.com.au",
  "uwe@factory2key.com.au",
  "barryh@hld.com.au",
];

const SEAFIELDS_BRAND = {
  primary: "#1A2744",
  accent: "#00B5AD",
  ink: "#0F172A",
  muted: "#64748B",
  surface: "#F8FAFC",
};

export async function getActiveRecipients(): Promise<string[]> {
  try {
    const supabase = createSupabaseService();
    const { data, error } = await (
      supabase.from("seafields_notify_recipients") as any
    )
      .select("email")
      .eq("active", true);
    if (error) return FALLBACK_RECIPIENTS;
    const list = (data ?? []) as { email: string }[];
    if (list.length === 0) return FALLBACK_RECIPIENTS;
    return list.map((r) => r.email);
  } catch {
    return FALLBACK_RECIPIENTS;
  }
}

interface RenderArgs {
  preheader: string;
  heading: string;
  intro?: string;
  rows: Array<{ label: string; value: string }>;
  footer?: string;
  ctaLabel?: string;
  ctaHref?: string;
}

/** Branded HTML email body. Inline styles only — most mail clients strip
 * <style> blocks. The structure stays consistent across event types so
 * the recipient inbox doesn't fragment visually. */
export function renderBrandedEmail({
  preheader,
  heading,
  intro,
  rows,
  footer,
  ctaLabel,
  ctaHref,
}: RenderArgs): string {
  const { primary, accent, ink, muted, surface } = SEAFIELDS_BRAND;
  const safeRows = rows
    .map(
      (r) => `
      <tr>
        <td style="padding:6px 16px;color:${muted};font-size:12px;width:160px;vertical-align:top;font-family:Arial,sans-serif">${escapeHtml(r.label)}</td>
        <td style="padding:6px 16px;color:${ink};font-size:14px;vertical-align:top;font-family:Arial,sans-serif">${r.value}</td>
      </tr>`,
    )
    .join("");

  return `<!doctype html>
<html><body style="margin:0;padding:0;background:${surface};font-family:Arial,sans-serif;color:${ink}">
  <div style="display:none;max-height:0;overflow:hidden;color:transparent">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${surface};padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:6px;overflow:hidden">
        <tr>
          <td style="background:${primary};color:#FFFFFF;padding:18px 24px;font-family:Arial,sans-serif">
            <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#94A3B8">Seafields Estate · Admin</div>
            <div style="font-size:20px;font-weight:700;margin-top:4px;color:#FFFFFF">${escapeHtml(heading)}</div>
          </td>
        </tr>
        ${
          intro
            ? `<tr><td style="padding:18px 24px 0;font-size:14px;color:${ink};line-height:1.5;font-family:Arial,sans-serif">${intro}</td></tr>`
            : ""
        }
        <tr><td style="padding:14px 8px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${safeRows}</table>
        </td></tr>
        ${
          ctaLabel && ctaHref
            ? `<tr><td align="left" style="padding:8px 24px 24px"><a href="${ctaHref}" style="display:inline-block;background:${accent};color:#FFFFFF;text-decoration:none;font-weight:600;padding:10px 18px;border-radius:4px;font-size:14px;font-family:Arial,sans-serif">${escapeHtml(ctaLabel)}</a></td></tr>`
            : ""
        }
        ${
          footer
            ? `<tr><td style="padding:16px 24px;border-top:1px solid #E2E8F0;font-size:12px;color:${muted};line-height:1.5;font-family:Arial,sans-serif">${footer}</td></tr>`
            : ""
        }
      </table>
      <div style="margin-top:14px;color:${muted};font-size:11px;font-family:Arial,sans-serif">
        You receive these because you are on the Seafields notification list. Manage at
        <a href="https://f2k-projects.vercel.app/admin/seafields-registrations" style="color:${muted}">/admin/seafields-registrations</a>.
      </div>
    </td></tr>
  </table>
</body></html>`;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatCurrency(n: number | null | undefined): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(n);
}
