import { NextResponse } from "next/server";
import { registrationsMaintenanceGuard } from "@/lib/maintenance";
import { createSupabaseService } from "@/lib/supabase-service";
import { escapeHtml } from "@/lib/html-escape";
import { guardRecipients } from "@/lib/email/recipient-guard";
import { registrantAckFooterHtml } from "@/lib/email/unsubscribe";
import { z } from "zod";

export const dynamic = "force-dynamic";

/**
 * Register-of-interest for Dutton Terrace (first Archetype-C estate). Captures the standard
 * buyer profile PLUS the demand-validation anchors (interest_type / lot_size_preference /
 * budget_band) that feed the funder revenue-stack test. Service-role insert (RLS deny-by-default)
 * + best-effort admin notification. hp_field honeypot handled client-side (time-trap + autofill-
 * safe name); a bare website_url-style honeypot is deliberately not used.
 */

const schema = z.object({
  first_name: z.string().min(1, "First name is required").max(100),
  last_name: z.string().min(1, "Last name is required").max(100),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().max(30).nullable().optional(),
  interest_type: z.string().max(100).nullable().optional(),
  lot_size_preference: z.string().max(100).nullable().optional(),
  budget_band: z.string().max(100).nullable().optional(),
  suburb: z.string().max(100).nullable().optional(),
  postcode: z.string().max(4).nullable().optional(),
  buyer_type: z.string().max(50).nullable().optional(),
  buyer_profile: z.string().max(50).nullable().optional(),
  current_housing: z.string().max(50).nullable().optional(),
  purchase_timeline: z.string().max(50).nullable().optional(),
  finance_status: z.string().max(50).nullable().optional(),
  how_heard: z.string().max(50).nullable().optional(),
  // Referrer — REQUIRED hard gate (explicit "none" counts; missing/empty is rejected).
  referrer_type: z.string().min(1, "Please choose a referrer option.").max(50),
  referrer_name: z.string().max(200).nullable().optional(),
  referrer_company: z.string().max(200).nullable().optional(),
  referrer_contact: z.string().max(200).nullable().optional(),
  referrer_agent_id: z.string().uuid().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  consent: z.literal(true, {
    errorMap: () => ({
      message: "You must acknowledge this is a registration of interest only",
    }),
  }),
  // Anti-bot. honeypot accepts ANY value (never a 400); the time-trap is the primary signal.
  // Handled server-side so a real submission is never silently dropped on the client.
  hp_field: z.string().optional(),
  elapsed_ms: z.number().optional(),
});

const ADMIN_RECIPIENTS = ["dennis@factory2key.com.au", "uwe@factory2key.com.au"];

export async function POST(request: Request) {
  const paused = registrationsMaintenanceGuard();
  if (paused) return paused;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const d = parsed.data;

  // Anti-bot (server-side). The TIME-TRAP is the primary, false-positive-free signal and the only
  // HARD block. The honeypot is NON-BLOCKING + logged: browser password managers autofill even
  // off-screen hidden fields, so a filled honeypot must never drop a real lead (PRODUCT_STANDARDS).
  if (typeof d.hp_field === "string" && d.hp_field.trim() !== "") {
    console.warn("dutton register: honeypot filled (non-blocking, likely autofill)");
  }
  if (typeof d.elapsed_ms === "number" && d.elapsed_ms < 2500) {
    console.warn("dutton register bot trap (time):", { elapsed: d.elapsed_ms });
    return NextResponse.json({ success: true });
  }

  const supabase = createSupabaseService();

  const { error } = await (supabase.from("dutton_registrations") as any).insert({
    estate_slug: "dutton-terrace",
    first_name: d.first_name,
    last_name: d.last_name,
    email: d.email,
    phone: d.phone ?? null,
    interest_type: d.interest_type ?? null,
    lot_size_preference: d.lot_size_preference ?? null,
    budget_band: d.budget_band ?? null,
    suburb: d.suburb ?? null,
    postcode: d.postcode ?? null,
    buyer_type: d.buyer_type ?? null,
    buyer_profile: d.buyer_profile ?? null,
    current_housing: d.current_housing ?? null,
    purchase_timeline: d.purchase_timeline ?? null,
    finance_status: d.finance_status ?? null,
    how_heard: d.how_heard ?? null,
    referrer_type: d.referrer_type ?? null,
    referrer_name: d.referrer_name ?? null,
    referrer_company: d.referrer_company ?? null,
    referrer_contact: d.referrer_contact ?? null,
    referrer_agent_id: d.referrer_agent_id ?? null,
    notes: d.notes ?? null,
    consent: d.consent,
    consent_at: new Date().toISOString(),
    source: "web-roi",
  });

  if (error) {
    console.error("Dutton registration insert error:", error);
    return NextResponse.json({ error: "Registration failed. Please try again." }, { status: 500 });
  }

  // Best-effort admin notification (never blocks).
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    const from = process.env.RESEND_FROM_EMAIL || "Factory2Key <onboarding@resend.dev>";
    const guard = guardRecipients(ADMIN_RECIPIENTS, { triggeredByEmail: d.email });
    const row = (l: string, v: string | null | undefined) =>
      v ? `<tr><td style="padding:4px 12px;color:#666">${l}</td><td style="padding:4px 12px;color:#142C44">${escapeHtml(v)}</td></tr>` : "";
    const { error: adminErr } = await resend.emails.send({
      from,
      to: guard.to,
      subject: `New Dutton Terrace registration — ${d.first_name} ${d.last_name}`,
      html: `<div style="max-width:600px;font-family:sans-serif">
        <div style="background:#142C44;padding:20px 28px"><h1 style="color:#fff;margin:0;font-size:20px">New Dutton Terrace registration</h1>
        <p style="color:#C77F3A;margin:4px 0 0;font-size:13px">Archetype-C demand signal</p></div>
        <div style="padding:20px 28px;background:#fff"><table style="border-collapse:collapse;font-size:14px;width:100%">
          ${row("Name", `${d.first_name} ${d.last_name}`)}
          ${row("Email", d.email)}${row("Phone", d.phone)}
          ${row("Interested in", d.interest_type)}${row("Lot size pref", d.lot_size_preference)}
          ${row("Budget band", d.budget_band)}${row("Buyer type", d.buyer_type)}
          ${row("Timeline", d.purchase_timeline)}${row("Finance", d.finance_status)}
          ${row("From suburb", [d.suburb, d.postcode].filter(Boolean).join(" "))}
        </table>${d.notes ? `<p style="font-size:13px;color:#4A5568;margin-top:12px"><strong>Notes:</strong> ${escapeHtml(d.notes)}</p>` : ""}</div></div>`,
    });
    if (adminErr) console.error("dutton admin notification: Resend send error:", adminErr);

    // Confirmation to the registrant (approved opt-in acknowledgement).
    const confirmGuard = guardRecipients([d.email], { triggeredByEmail: d.email });
    const { error: confirmErr } = await resend.emails.send({
      from,
      to: confirmGuard.to,
      subject: "Factory2Key — your Dutton Terrace registration is received",
      html: `
        <div style="max-width:600px;font-family:sans-serif">
          <div style="background:#142C44;padding:24px 32px">
            <h1 style="color:#fff;margin:0;font-size:22px">Factory2Key · Dutton Terrace</h1>
          </div>
          <div style="padding:32px;background:#fff">
            <p style="font-size:16px;color:#142C44">Hi ${escapeHtml(d.first_name)},</p>
            <p style="font-size:14px;color:#4A5568;line-height:1.6">
              Thanks — we&apos;ve received your registration of interest in Dutton Terrace, Tumby Bay. We&apos;ll be in touch with updates and further information about the offer as the estate progresses.
            </p>
            <p style="font-size:14px;color:#4A5568;line-height:1.6">
              This is a registration of interest only — no deposit or commitment is required, and you&apos;re under no obligation.
            </p>
            <p style="font-size:14px;color:#142C44;margin-top:24px">
              Kind regards,<br><strong>The Factory2Key Team</strong>
            </p>
          </div>
          ${registrantAckFooterHtml(d.email)}
        </div>`,
    });
    if (confirmErr) console.error("dutton applicant confirmation: Resend send error:", confirmErr);
  } catch (err) {
    console.error("Dutton registration email failed:", err);
  }

  return NextResponse.json({ success: true });
}
