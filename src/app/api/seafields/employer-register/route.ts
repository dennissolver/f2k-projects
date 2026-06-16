import { NextResponse } from "next/server";
import { createSupabaseService } from "@/lib/supabase-service";
import { escapeHtml } from "@/lib/html-escape";
import { guardRecipients } from "@/lib/email/recipient-guard";
import { registrantAckFooterHtml } from "@/lib/email/unsubscribe";
import { z } from "zod";

export const dynamic = "force-dynamic";

/**
 * Take-or-pay (local-employer) registration for Seafields. The "rent it" path of
 * /seafields/employers. Same submit plumbing as the funder route — service-role insert (RLS
 * deny-by-default) + honeypot + consent + voice-transcript capture + best-effort Resend emails.
 *
 * Take-or-pay is ADMIN-HANDLED: notifications go to the internal F2K admin pair only (no external
 * buyer-sales partners, no agent attribution). The "own it" path never hits this route — it
 * redirects to the main Seafields buyer registration and writes no row here.
 */

// Internal, admin-handled recipients. Deliberately NOT the seafields buyer-notify list (which
// includes external sales partners) — a take-or-pay underwriting lead is internal.
const ADMIN_RECIPIENTS = [
  "dennis@factory2key.com.au",
  "uwe@factory2key.com.au",
];

const schema = z.object({
  business_name: z.string().min(1, "Business name is required").max(300),
  abn: z
    .string()
    .regex(/^\d{11}$/, "ABN must be 11 digits")
    .nullable()
    .optional(),
  contact_name: z.string().min(1, "Contact name is required").max(200),
  contact_email: z.string().email("Please enter a valid email address").max(300),
  contact_phone: z.string().max(60).nullable().optional(),
  staff_count: z.number().int().min(0).max(100000).nullable().optional(),
  unit_preference: z.enum(["whole_house", "by_room"]).nullable().optional(),
  quantity: z.number().int().min(0).max(100000).nullable().optional(),
  commitment_term_months: z.number().int().min(1).max(120).nullable().optional(),
  required_start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date")
    .nullable()
    .optional(),
  fifo_roles_replaced: z.string().max(4000).nullable().optional(),
  would_consider_buying: z.boolean().optional(),
  consent: z.literal(true, {
    errorMap: () => ({
      message: "Please acknowledge the registration-of-interest terms to continue",
    }),
  }),
  source_page: z.string().max(300).nullable().optional(),
  voice_transcript: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(4000),
      }),
    )
    .max(120)
    .optional(),
  voice_conversation_id: z.string().max(200).nullable().optional(),
  // Honeypot — accept any value (don't 400 a real user whose browser autofilled it);
  // a filled value is silently dropped below. The field name is autofill-neutral.
  hp_field: z.string().optional(),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  if (!json) {
    return NextResponse.json({ error: "Malformed request body" }, { status: 400 });
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  const d = parsed.data;

  // Silently accept honeypot hits without persisting (bot trap).
  if (d.hp_field) {
    return NextResponse.json({ success: true });
  }

  const supabase = createSupabaseService();

  // ---- Persist the registration (one row) ----
  const { data: inserted, error } = await (
    supabase.from("seafields_employer_registrations") as any
  )
    .insert({
      estate_slug: "seafields",
      business_name: d.business_name,
      abn: d.abn ?? null,
      contact_name: d.contact_name,
      contact_email: d.contact_email,
      contact_phone: d.contact_phone ?? null,
      staff_count: d.staff_count ?? null,
      unit_preference: d.unit_preference ?? null,
      quantity: d.quantity ?? null,
      commitment_term_months: d.commitment_term_months ?? null,
      required_start_date: d.required_start_date ?? null,
      fifo_roles_replaced: d.fifo_roles_replaced ?? null,
      would_consider_buying: d.would_consider_buying ?? false,
      consent: d.consent,
      consent_at: d.consent ? new Date().toISOString() : null,
      voice_transcript: d.voice_transcript ?? [],
      voice_conversation_id: d.voice_conversation_id ?? null,
      source_page: d.source_page ?? null,
      status: "new",
      inserted_via: "web_form",
    } as never)
    .select("id")
    .single();

  if (error) {
    console.error("Employer registration insert error:", error);
    return NextResponse.json(
      { error: "Registration failed. Please try again." },
      { status: 500 },
    );
  }

  // Audit log (best-effort).
  try {
    await supabase.from("audit_log").insert({
      actor_id: null,
      actor_email: d.contact_email,
      action: "seafields_employer_registration_submitted",
      entity_type: "seafields_employer_registration",
      entity_id: inserted?.id ?? null,
      details: {
        business: d.business_name,
        unit_preference: d.unit_preference ?? null,
        quantity: d.quantity ?? null,
        commitment_term_months: d.commitment_term_months ?? null,
        would_consider_buying: d.would_consider_buying ?? false,
      },
    });
  } catch (err) {
    console.error("Employer registration audit log failed:", err);
  }

  // ---- Notify the F2K team + confirm to the employer (best-effort, never blocks) ----
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    const from =
      process.env.RESEND_FROM_EMAIL || "Factory2Key <onboarding@resend.dev>";

    const guard = guardRecipients(ADMIN_RECIPIENTS, {
      triggeredByEmail: d.contact_email,
    });

    const unitLabel =
      d.unit_preference === "whole_house"
        ? "Whole house(s)"
        : d.unit_preference === "by_room"
          ? "By the room"
          : "";

    const e = {
      business_name: escapeHtml(d.business_name),
      abn: escapeHtml(d.abn),
      contact_name: escapeHtml(d.contact_name),
      contact_email: escapeHtml(d.contact_email),
      contact_phone: escapeHtml(d.contact_phone),
      fifo_roles_replaced: escapeHtml(d.fifo_roles_replaced),
    };

    const row = (label: string, value: string) =>
      value
        ? `<tr><td style="padding:4px 12px;color:#666;vertical-align:top">${label}</td><td style="padding:4px 12px;color:#142C44">${value}</td></tr>`
        : "";

    const transcript = d.voice_transcript?.length
      ? d.voice_transcript
          .map(
            (m) =>
              `<p style="margin:4px 0"><strong style="color:${m.role === "assistant" ? "#C77F3A" : "#142C44"}">${m.role === "assistant" ? "Morgan" : "Employer"}:</strong> ${escapeHtml(m.content)}</p>`,
          )
          .join("")
      : "";

    const adminHtml = `
      <div style="max-width:640px;font-family:sans-serif">
        <div style="background:#142C44;padding:24px 32px">
          <h1 style="color:#fff;margin:0;font-size:22px">New Take-or-Pay Registration</h1>
          <p style="color:#C77F3A;margin:4px 0 0;font-size:13px">${e.business_name} — Seafields local employer accommodation</p>
        </div>
        <div style="padding:24px 32px;background:#fff">
          <table style="border-collapse:collapse;font-size:14px;width:100%">
            ${row("Business", `<strong>${e.business_name}</strong>`)}
            ${row("ABN", e.abn)}
            ${row("Contact", `<strong>${e.contact_name}</strong>`)}
            ${row("Email", `<a href="mailto:${encodeURIComponent(d.contact_email)}" style="color:#142C44">${e.contact_email}</a>`)}
            ${row("Phone", e.contact_phone)}
            ${row("Staff needing accommodation", d.staff_count != null ? String(d.staff_count) : "")}
            ${row("Unit preference", unitLabel)}
            ${row("Quantity", d.quantity != null ? String(d.quantity) : "")}
            ${row("Commitment term", d.commitment_term_months != null ? `${d.commitment_term_months} months` : "")}
            ${row("Required start", d.required_start_date ?? "")}
            ${row("Would also consider buying", d.would_consider_buying ? "Yes" : "No")}
          </table>
          ${e.fifo_roles_replaced ? `<h3 style="color:#142C44;font-size:14px;margin:20px 0 4px">FIFO roles this would replace</h3><p style="font-size:14px;color:#4A5568;line-height:1.6;white-space:pre-wrap">${e.fifo_roles_replaced}</p>` : ""}
          ${transcript ? `<h3 style="color:#142C44;font-size:14px;margin:20px 0 4px">Voice discovery (Morgan)</h3><div style="font-size:13px;color:#4A5568;line-height:1.5;background:#F8FAFC;padding:12px 16px;border-radius:6px">${transcript}</div>` : ""}
        </div>
        <div style="background:#F5F3EE;padding:16px 32px;font-size:11px;color:#999">
          Take-or-pay registration of interest from a local employer via the Seafields employer page. Admin-handled; not a lease or an offer.${guard.rerouted ? ` [rerouted: ${guard.reason}; intended ${guard.original.join(", ")}]` : ""}
        </div>
      </div>`;

    await resend.emails.send({
      from,
      to: guard.to,
      subject: `New take-or-pay registration — ${d.business_name} (Seafields)`,
      html: adminHtml,
    });

    // Confirmation to the employer.
    const confirmGuard = guardRecipients([d.contact_email], {
      triggeredByEmail: d.contact_email,
    });
    await resend.emails.send({
      from,
      to: confirmGuard.to,
      subject: "Factory2Key — your staff accommodation interest is registered",
      html: `
        <div style="max-width:600px;font-family:sans-serif">
          <div style="background:#142C44;padding:24px 32px">
            <h1 style="color:#fff;margin:0;font-size:22px">Factory2Key · Seafields</h1>
          </div>
          <div style="padding:32px;background:#fff">
            <p style="font-size:16px;color:#142C44">Hi ${escapeHtml(d.contact_name.split(" ")[0] || d.contact_name)},</p>
            <p style="font-size:14px;color:#4A5568;line-height:1.6">
              Thank you for registering ${e.business_name}&apos;s interest in take-or-pay staff accommodation at Seafields. Dennis will be in touch to size the demand and walk through the commercial terms.
            </p>
            <p style="font-size:14px;color:#4A5568;line-height:1.6">
              This is a registration of interest only — it is not a lease or an offer, creates no obligation on either side, and any take-or-pay commitment is subject to formal documentation.
            </p>
            <p style="font-size:14px;color:#142C44;margin-top:24px">
              Kind regards,<br><strong>The Factory2Key Team</strong>
            </p>
          </div>
          ${registrantAckFooterHtml(d.contact_email)}
        </div>`,
    });
  } catch (err) {
    console.error("Failed to send employer registration emails:", err);
  }

  return NextResponse.json({ success: true });
}
