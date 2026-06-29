import { NextResponse } from "next/server";
import { registrationsMaintenanceGuard } from "@/lib/maintenance";
import { createSupabaseService } from "@/lib/supabase-service";
import { escapeHtml } from "@/lib/html-escape";
import { guardRecipients } from "@/lib/email/recipient-guard";
import { registrantAckFooterHtml } from "@/lib/email/unsubscribe";
import { z } from "zod";

const schema = z.object({
  first_name: z.string().min(1, "First name is required").max(100),
  last_name: z.string().min(1, "Last name is required").max(100),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().max(30).nullable().optional(),
  interest_type: z.string().max(100).nullable().optional(),
  // Location
  suburb: z.string().max(100).nullable().optional(),
  postcode: z.string().max(4).nullable().optional(),
  // Buyer profile
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

export async function POST(request: Request) {
  const paused = registrationsMaintenanceGuard();
  if (paused) return paused;

  const body = await request.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const d = parsed.data;

  // Anti-bot (server-side). The TIME-TRAP is the primary, false-positive-free signal and the only
  // HARD block. The honeypot is NON-BLOCKING + logged: browser password managers autofill even
  // off-screen hidden fields, so a filled honeypot must never drop a real lead (PRODUCT_STANDARDS).
  if (typeof d.hp_field === "string" && d.hp_field.trim() !== "") {
    console.warn("wavecrest register: honeypot filled (non-blocking, likely autofill)");
  }
  if (typeof d.elapsed_ms === "number" && d.elapsed_ms < 2500) {
    console.warn("wavecrest register bot trap (time):", { elapsed: d.elapsed_ms });
    return NextResponse.json({ success: true });
  }

  const supabase = createSupabaseService();

  // Try to insert into wavecrest_registrations table
  // Table may not exist yet - that's OK, we'll handle gracefully
  const { error } = await (supabase.from("wavecrest_registrations") as any).insert({
    first_name: d.first_name,
    last_name: d.last_name,
    email: d.email,
    phone: d.phone,
    interest_type: d.interest_type,
    suburb: d.suburb,
    postcode: d.postcode,
    buyer_type: d.buyer_type,
    buyer_profile: d.buyer_profile,
    current_housing: d.current_housing,
    purchase_timeline: d.purchase_timeline,
    finance_status: d.finance_status,
    how_heard: d.how_heard,
    referrer_type: d.referrer_type,
    referrer_name: d.referrer_name,
    referrer_company: d.referrer_company,
    referrer_contact: d.referrer_contact,
    notes: d.notes,
    consent: d.consent,
    consent_at: new Date().toISOString(),
    source: "web-roi",
    created_at: new Date().toISOString(),
  });

  if (error) {
    console.error("Wavecrest registration insert error:", error);
  } else {
    console.log("Wavecrest registration:", {
      name: `${d.first_name} ${d.last_name}`,
      email: d.email,
      interest_type: d.interest_type,
    });
  }

  // Confirmation to the registrant (approved opt-in acknowledgement). Best-effort.
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    const from = process.env.RESEND_FROM_EMAIL || "Factory2Key <onboarding@resend.dev>";
    const confirmGuard = guardRecipients([d.email], { triggeredByEmail: d.email });
    await resend.emails.send({
      from,
      to: confirmGuard.to,
      subject: "Factory2Key — your Wavecrest registration is received",
      html: `
        <div style="max-width:600px;font-family:sans-serif">
          <div style="background:#142C44;padding:24px 32px">
            <h1 style="color:#fff;margin:0;font-size:22px">Factory2Key · Wavecrest</h1>
          </div>
          <div style="padding:32px;background:#fff">
            <p style="font-size:16px;color:#142C44">Hi ${escapeHtml(d.first_name)},</p>
            <p style="font-size:14px;color:#4A5568;line-height:1.6">
              Thanks — we&apos;ve received your registration of interest in Wavecrest. We&apos;ll be in touch with updates and further information about the offer as the estate progresses.
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
  } catch (err) {
    console.error("Wavecrest confirmation email failed:", err);
  }

  return NextResponse.json({ success: true });
}
