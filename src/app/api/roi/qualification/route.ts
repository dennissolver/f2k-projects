import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { registrationsMaintenanceGuard } from "@/lib/maintenance";
import { createSupabaseService } from "@/lib/supabase-service";
import { escapeHtml } from "@/lib/html-escape";
import { getActiveRecipients, renderBrandedEmail } from "@/lib/branscombe/notify";
import { guardRecipients } from "@/lib/email/recipient-guard";
import { registrantAckFooterHtml } from "@/lib/email/unsubscribe";
import { parseQualifyToken } from "@/lib/roi/qualify-link";
import {
  PURCHASER_ENTITY_TYPES,
  FINANCE_STATUSES,
  CONTACT_METHODS,
} from "@/lib/roi/estate-config";

/**
 * ROI portal — artefact 2: the qualification form (EOI) submission (spec §7).
 *
 * Reached via a signed qualify link tied to a waitlist record. Attribution is COPIED from
 * that waitlist row into the registrations row and locked (migration 0063 trigger) — the buyer
 * never types or changes it. Writes the rich §7 answers into `payload` jsonb + ranked units.
 */

const subjectToFinance = z.enum(["Y", "N", "TBC"]);

const schema = z.object({
  token: z.string().min(1),
  // A. Applicant
  full_name: z.string().min(1, "Please enter the applicant's name").max(160),
  applicants_count: z.number().int().min(1).max(2),
  applicant2_name: z.string().max(160).nullable().optional(),
  mobile: z.string().max(40).nullable().optional(),
  email: z.string().email("Please enter a valid email address"),
  postal_address: z.string().max(300).nullable().optional(),
  buyer_category: z.string().max(60).nullable().optional(),
  purchaser_entity_type: z.enum(PURCHASER_ENTITY_TYPES),
  preferred_contact_method: z.enum(CONTACT_METHODS),
  // B. Preferred homes — up to three ranked unit numbers.
  ranked_unit_numbers: z
    .array(z.number().int().positive())
    .min(1, "Please select at least one preferred home")
    .max(3, "You can rank at most three homes"),
  // C. Commercial terms
  indicative_price: z.number().int().positive().nullable().optional(),
  deposit_option: z.enum(["5%", "7.5%", "10%", "Other"]),
  deposit_other_pct: z.number().min(5).max(100).nullable().optional(),
  finance_status: z.enum(FINANCE_STATUSES),
  lender_broker: z.string().max(160).nullable().optional(),
  estimated_amount_or_lvr: z.string().max(80).nullable().optional(),
  subject_to_finance: subjectToFinance,
  finance_approval_days: z.string().max(40).nullable().optional(),
  settlement_timing: z.string().max(200).nullable().optional(),
  special_comments: z.string().max(2000).nullable().optional(),
  // D. Colour scheme
  colour_scheme: z.string().max(80).nullable().optional(),
  // E. Acknowledgements (all required to submit)
  consent_eoi_only: z.literal(true, {
    errorMap: () => ({ message: "Please acknowledge this is an expression of interest only" }),
  }),
  consent_nonbinding: z.literal(true, {
    errorMap: () => ({ message: "Please acknowledge this does not bind the vendor to sell" }),
  }),
  consent_privacy: z.literal(true, {
    errorMap: () => ({ message: "Please acknowledge the privacy collection notice" }),
  }),
  consent_contact: z.boolean().optional().default(false),
  // F. Signature
  signature_name: z.string().min(1, "Please type your name to confirm").max(160),
  signature_date: z.string().min(1).max(40),
  // Anti-bot
  hp_field: z.string().optional(),
  elapsed_ms: z.number().optional(),
});

export async function POST(request: Request) {
  const paused = registrationsMaintenanceGuard();
  if (paused) return paused;

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const d = parsed.data;

  // Anti-bot: time-trap + accept-any honeypot, both silent no-op (never drop a real submit).
  if (
    (typeof d.hp_field === "string" && d.hp_field.trim() !== "") ||
    (typeof d.elapsed_ms === "number" && d.elapsed_ms < 2500)
  ) {
    console.warn("roi qualification bot trap");
    return NextResponse.json({ success: true });
  }

  // Deposit floor 5% (spec §7.C — never anchor below 5%).
  if (d.deposit_option === "Other" && (d.deposit_other_pct == null || d.deposit_other_pct < 5)) {
    return NextResponse.json(
      { error: "Deposit must be at least 5%." },
      { status: 400 },
    );
  }

  const tok = parseQualifyToken(d.token);
  if (!tok) {
    return NextResponse.json(
      { error: "This registration link is invalid or has expired. Please ask your agent for a new one." },
      { status: 400 },
    );
  }

  const supabase = createSupabaseService();

  // Load the waitlist record this EOI is tied to → estate + attribution to copy.
  const { data: waitlist } = await (supabase.from("waitlist_registrations") as any)
    .select("id, estate_id, introducing_agency_id, introducing_agent_id, email")
    .eq("id", tok.waitlistId)
    .maybeSingle();
  if (!waitlist) {
    return NextResponse.json({ error: "Registration link not found." }, { status: 404 });
  }

  // Representation guardrail: ranked units must be real units of this estate (spec §8).
  const { data: estateUnits } = await (supabase.from("units") as any)
    .select("unit_number")
    .eq("estate_id", waitlist.estate_id);
  const validUnits = new Set<number>((estateUnits ?? []).map((u: any) => u.unit_number));
  const badUnit = d.ranked_unit_numbers.find((n) => !validUnits.has(n));
  if (badUnit !== undefined) {
    return NextResponse.json(
      { error: `Home ${badUnit} is not part of this estate.` },
      { status: 400 },
    );
  }

  const hdrs = headers();
  const submitterIp = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const userAgent = hdrs.get("user-agent") || null;

  // Everything that isn't a first-class column goes into payload jsonb.
  const payload = {
    full_name: d.full_name.trim(),
    applicants_count: d.applicants_count,
    applicant2_name: d.applicant2_name?.trim() || null,
    mobile: d.mobile?.trim() || null,
    email: d.email.trim().toLowerCase(),
    postal_address: d.postal_address?.trim() || null,
    buyer_category: d.buyer_category ?? null,
    purchaser_entity_type: d.purchaser_entity_type,
    preferred_contact_method: d.preferred_contact_method,
    indicative_price: d.indicative_price ?? null,
    deposit: d.deposit_option === "Other" ? `${d.deposit_other_pct}%` : d.deposit_option,
    finance_status: d.finance_status,
    lender_broker: d.lender_broker?.trim() || null,
    estimated_amount_or_lvr: d.estimated_amount_or_lvr?.trim() || null,
    subject_to_finance: d.subject_to_finance,
    finance_approval_days: d.finance_approval_days ?? null,
    settlement_timing: d.settlement_timing?.trim() || null,
    special_comments: d.special_comments?.trim() || null,
    colour_scheme: d.colour_scheme ?? null,
    signature_name: d.signature_name.trim(),
    signature_date: d.signature_date,
  };

  const { data: reg, error } = await (supabase.from("registrations") as any)
    .insert({
      estate_id: waitlist.estate_id,
      waitlist_id: waitlist.id,
      ranked_unit_numbers: d.ranked_unit_numbers,
      // Attribution COPIED from the waitlist record — immutable (spec §4; 0063 trigger).
      introducing_agency_id: waitlist.introducing_agency_id,
      introducing_agent_id: waitlist.introducing_agent_id,
      payload,
      terms_version: null,
      consent_privacy: true,
      consent_nonbinding: true,
      consent_contact: d.consent_contact ?? false,
      submitter_ip: submitterIp,
      user_agent: userAgent,
      status: "new",
    })
    .select("id")
    .single();

  if (error) {
    console.error("roi qualification insert error:", error);
    return NextResponse.json(
      { error: "Submission failed. Please try again." },
      { status: 500 },
    );
  }

  // Mark the waitlist record as qualified.
  await (supabase.from("waitlist_registrations") as any)
    .update({ status: "qualified" })
    .eq("id", waitlist.id);

  await supabase.from("audit_log").insert({
    actor_id: null,
    actor_email: payload.email,
    action: "roi_qualification_submitted",
    entity_type: "registration",
    entity_id: reg.id,
    details: {
      waitlist_id: waitlist.id,
      ranked_units: d.ranked_unit_numbers,
      attributed: !!waitlist.introducing_agent_id,
      entity_type: d.purchaser_entity_type,
    },
  });

  // Notifications — best-effort.
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    const from =
      process.env.RESEND_FROM_EMAIL ||
      "Branscombe Estate <noreply@updates.corporateaisolutions.com>";

    const unitList = d.ranked_unit_numbers.map((n) => `Home ${n}`).join(", ");
    const priceText =
      payload.indicative_price != null
        ? `$${payload.indicative_price.toLocaleString()}`
        : "POA — discuss with agent";
    const rows: Array<{ label: string; value: string }> = [
      { label: "Applicant", value: `<strong>${escapeHtml(payload.full_name)}</strong>` },
      { label: "Email", value: escapeHtml(payload.email) },
      { label: "Preferred homes", value: `<strong>${escapeHtml(unitList)}</strong>` },
      { label: "Entity", value: escapeHtml(payload.purchaser_entity_type) },
      { label: "Indicative price", value: escapeHtml(priceText) },
      { label: "Deposit", value: escapeHtml(payload.deposit) },
      { label: "Finance", value: escapeHtml(payload.finance_status) },
    ];
    if (payload.colour_scheme) rows.push({ label: "Colour scheme", value: escapeHtml(payload.colour_scheme) });

    // F2K admin + introducing-agent copy.
    const recipients = await getActiveRecipients();
    let agentEmail: string | null = null;
    if (waitlist.introducing_agent_id) {
      const { data: agent } = await (supabase.from("agents") as any)
        .select("email")
        .eq("id", waitlist.introducing_agent_id)
        .maybeSingle();
      agentEmail = agent?.email ?? null;
    }
    const adminTo = Array.from(new Set([...recipients, ...(agentEmail ? [agentEmail] : [])]));
    const adminHtml = renderBrandedEmail({
      preheader: `${payload.full_name} completed the registration form`,
      heading: `Qualification (EOI) received — ${escapeHtml(payload.full_name)}`,
      intro: `${escapeHtml(payload.full_name)} completed the full registration form for ${escapeHtml(unitList)}.`,
      rows,
      ctaLabel: "Open in admin",
      ctaHref: "https://f2k-projects.vercel.app/admin/branscombe-pipeline",
      footer:
        "Expression of interest only — non-binding, no deposit. Attribution travels with this record.",
    });
    const adminGuard = guardRecipients(adminTo, { triggeredByEmail: payload.email });
    await resend.emails.send({
      to: adminGuard.to,
      from,
      subject: `EOI from ${payload.full_name} — ${unitList}`,
      html: adminHtml,
    });

    // Applicant confirmation (restates non-binding).
    const confirmGuard = guardRecipients(payload.email, { triggeredByEmail: payload.email });
    await resend.emails.send({
      to: confirmGuard.to,
      from,
      subject: "Branscombe Estate — your registration is received",
      html: `
        <div style="max-width:600px;font-family:sans-serif">
          <div style="background:#1A2744;padding:24px 32px">
            <h1 style="color:#FFFFFF;margin:0;font-size:24px">Branscombe Estate</h1>
            <p style="color:#00B5AD;margin:4px 0 0;font-size:13px">A Factory2Key Development</p>
          </div>
          <div style="padding:32px;background:#FFFFFF">
            <p style="font-size:16px;color:#1A2744">Hi ${escapeHtml(payload.full_name)},</p>
            <p style="font-size:14px;color:#4A5568;line-height:1.6">
              Thank you — we've received your registration for <strong>${escapeHtml(unitList)}</strong>.
              This is an expression of interest only: it does not oblige the vendor to sell or reserve
              a home, no money is payable, all figures are indicative, and nothing is binding unless and
              until a contract is signed and exchanged.
            </p>
            <p style="font-size:14px;color:#4A5568;line-height:1.6">
              Your agent and the Factory2Key team will be in touch. Questions? Just reply to this email.
            </p>
            <p style="font-size:14px;color:#1A2744;margin-top:24px">Warm regards,<br><strong>The Factory2Key Team</strong></p>
          </div>
          ${registrantAckFooterHtml(payload.email)}
        </div>
      `,
    });
  } catch (err) {
    console.error("roi qualification email failed:", err);
  }

  return NextResponse.json({ success: true });
}
