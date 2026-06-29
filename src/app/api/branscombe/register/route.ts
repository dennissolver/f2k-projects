import { NextResponse } from "next/server";
import { registrationsMaintenanceGuard } from "@/lib/maintenance";
import { createSupabaseService } from "@/lib/supabase-service";
import { escapeHtml } from "@/lib/html-escape";
import { forwardRegistrationToGHL } from "@/lib/ghl";
import {
  getActiveRecipients,
  renderBrandedEmail,
} from "@/lib/branscombe/notify";
import { guardRecipients } from "@/lib/email/recipient-guard";
import { registrantAckFooterHtml } from "@/lib/email/unsubscribe";
import { z } from "zod";

const schema = z.object({
  first_name: z.string().min(1, "First name is required").max(100),
  last_name: z.string().min(1, "Last name is required").max(100),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().max(30).nullable().optional(),
  units_selected: z
    .array(z.string().regex(/^U\d{1,2}$/))
    .min(1, "Please select at least one home")
    .max(3, "You can register interest in at most three homes"),
  price_preferences: z.record(z.string(), z.string()).optional(),
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
    console.warn("branscombe register: honeypot filled (non-blocking, likely autofill)");
  }
  if (typeof d.elapsed_ms === "number" && d.elapsed_ms < 2500) {
    console.warn("branscombe register bot trap (time):", { elapsed: d.elapsed_ms });
    return NextResponse.json({ success: true });
  }

  const supabase = createSupabaseService();

  const { error } = await (supabase.from("branscombe_registrations") as any).insert({
    first_name: d.first_name,
    last_name: d.last_name,
    email: d.email,
    phone: d.phone ?? null,
    units_selected: d.units_selected,
    price_preferences: d.price_preferences ?? {},
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
    agent_id: d.referrer_agent_id ?? null,
    notes: d.notes ?? null,
    consent: true,
    consent_at: new Date().toISOString(),
    source: "web-roi",
  } as never);

  if (error) {
    console.error("Branscombe registration insert error:", error);
    return NextResponse.json(
      { error: "Registration failed. Please try again." },
      { status: 500 }
    );
  }

  // Audit log
  await supabase.from("audit_log").insert({
    actor_id: null,
    actor_email: d.email,
    action: "branscombe_roi_submitted",
    entity_type: "branscombe_registration",
    entity_id: null,
    details: {
      name: `${d.first_name} ${d.last_name}`,
      units: d.units_selected,
      price_preferences: d.price_preferences,
      location: d.suburb ? `${d.suburb} ${d.postcode || ""}`.trim() : null,
      buyer_type: d.buyer_type,
      buyer_profile: d.buyer_profile,
      referrer: d.referrer_name ? `${d.referrer_name} (${d.referrer_type})` : null,
    },
  });

  // Email notification via Resend
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);

    // unit IDs match /^U\d{1,2}$/ (validated by Zod) — safe to interpolate,
    // but we still escape for defense in depth.
    const unitList = d.units_selected.map(escapeHtml).join(", ");
    const priceRows = d.price_preferences
      ? Object.entries(d.price_preferences)
          .map(
            ([uid, range]) =>
              `<tr><td style="padding:2px 12px;color:#666">${escapeHtml(uid)}</td><td style="padding:2px 12px">${escapeHtml(range)}</td></tr>`
          )
          .join("")
      : "";
    const referrerRow =
      d.referrer_name
        ? `<tr><td style="padding:4px 12px;color:#666">Referrer</td><td style="padding:4px 12px">${escapeHtml(d.referrer_name)}${d.referrer_company ? ` — ${escapeHtml(d.referrer_company)}` : ""}${d.referrer_contact ? ` (${escapeHtml(d.referrer_contact)})` : ""} [${escapeHtml(d.referrer_type)}]</td></tr>`
        : "";
    // Pre-escape every user-controlled field used in the HTML template below.
    const e = {
      first_name: escapeHtml(d.first_name),
      last_name: escapeHtml(d.last_name),
      email: escapeHtml(d.email),
      emailHref: encodeURIComponent(d.email),
      phone: escapeHtml(d.phone),
      suburb: escapeHtml(d.suburb),
      postcode: escapeHtml(d.postcode),
      buyer_type: escapeHtml(d.buyer_type),
      buyer_profile: escapeHtml(d.buyer_profile),
      current_housing: escapeHtml(d.current_housing),
      purchase_timeline: escapeHtml(d.purchase_timeline),
      finance_status: escapeHtml(d.finance_status),
      how_heard: escapeHtml(d.how_heard),
      notes: escapeHtml(d.notes),
    };

    // Admin notification — recipients from DB (table managed at
    // /admin/branscombe-pipeline). Branded template matching Seafields.
    const recipients = await getActiveRecipients();
    const fullName = `${d.first_name.trim()} ${d.last_name.trim()}`.trim();
    const subjectUnitPhrase =
      d.units_selected.length === 1
        ? d.units_selected[0]
        : `${d.units_selected.length} homes (${d.units_selected.join(", ")})`;

    const adminRows: Array<{ label: string; value: string }> = [
      { label: "Registrant", value: `<strong>${e.first_name} ${e.last_name}</strong>` },
      {
        label: "Email",
        value: `<a href="mailto:${e.emailHref}" style="color:#1A2744">${e.email}</a>`,
      },
    ];
    if (d.phone) adminRows.push({ label: "Phone", value: e.phone });
    if (d.suburb)
      adminRows.push({
        label: "Location",
        value: `${e.suburb}${d.postcode ? ` ${e.postcode}` : ""}`,
      });
    adminRows.push({
      label: d.units_selected.length === 1 ? "Home" : "Homes",
      value: `<strong>${unitList}</strong>`,
    });
    if (d.buyer_type) adminRows.push({ label: "Buyer type", value: e.buyer_type });
    if (d.buyer_profile)
      adminRows.push({ label: "Profile", value: e.buyer_profile });
    if (d.current_housing)
      adminRows.push({ label: "Current housing", value: e.current_housing });
    if (d.purchase_timeline)
      adminRows.push({ label: "Timeline", value: e.purchase_timeline });
    if (d.finance_status)
      adminRows.push({ label: "Finance", value: e.finance_status });
    if (d.how_heard) adminRows.push({ label: "How heard", value: e.how_heard });
    if (referrerRow) {
      const referrerText =
        `${d.referrer_name ? escapeHtml(d.referrer_name) : ""}` +
        `${d.referrer_company ? ` — ${escapeHtml(d.referrer_company)}` : ""}` +
        `${d.referrer_contact ? ` (${escapeHtml(d.referrer_contact)})` : ""}` +
        ` <span style="color:#94A3B8">[${escapeHtml(d.referrer_type || "")}]</span>`;
      adminRows.push({ label: "Referrer", value: referrerText });
    }
    if (d.notes) adminRows.push({ label: "Notes", value: e.notes });

    if (priceRows) {
      adminRows.push({
        label: "Price expectations",
        value: `<table style="margin:2px 0;border-collapse:collapse">${priceRows.replace(
          /<tr>/g,
          '<tr style="background:#F8FAFC">',
        )}</table>`,
      });
    }

    const adminHtml = renderBrandedEmail({
      preheader: `${fullName} registered for ${d.units_selected.join(", ")}`,
      heading:
        d.units_selected.length === 1
          ? `Another registration for ${subjectUnitPhrase} by ${fullName}`
          : `New registration by ${fullName}`,
      intro:
        d.units_selected.length === 1
          ? `${escapeHtml(fullName)} just registered interest in <strong>${escapeHtml(subjectUnitPhrase)}</strong>.`
          : `${escapeHtml(fullName)} just registered interest in ${d.units_selected.length} homes: <strong>${escapeHtml(d.units_selected.join(", "))}</strong>.`,
      rows: adminRows,
      ctaLabel: "Open in admin",
      ctaHref:
        "https://f2k-projects.vercel.app/admin/branscombe-pipeline",
      footer:
        "Registration of Interest only — no deposit taken. Reply directly to the registrant from your inbox or follow up from the admin panel.",
    });

    // Keep test/non-production submissions out of real recipients' inboxes.
    const adminGuard = guardRecipients(recipients, { triggeredByEmail: d.email });
    const confirmGuard = guardRecipients(d.email, { triggeredByEmail: d.email });

    const { error: adminErr } = await resend.emails.send({
      from:
        process.env.RESEND_FROM_EMAIL ||
        "Branscombe Estate <onboarding@resend.dev>",
      to: adminGuard.to,
      subject: `Another registration for ${subjectUnitPhrase} by ${fullName}`,
      html: adminHtml,
    });
    if (adminErr) console.error("branscombe ROI admin notification: Resend send error:", adminErr);

    // Registrant confirmation
    const { error: confirmErr } = await resend.emails.send({
      from:
        process.env.RESEND_FROM_EMAIL ||
        "Branscombe Estate <onboarding@resend.dev>",
      to: confirmGuard.to,
      subject: "Branscombe Estate — Thank You for Your Interest",
      html: `
        <div style="max-width:600px;font-family:sans-serif">
          <div style="background:#1A2744;padding:24px 32px">
            <h1 style="color:#FFFFFF;margin:0;font-size:24px">Branscombe Estate</h1>
            <p style="color:#00B5AD;margin:4px 0 0;font-size:13px">A Factory2Key Development &middot; Claremont, Tasmania</p>
          </div>
          <div style="padding:32px;background:#FFFFFF">
            <p style="font-size:16px;color:#1A2744">Hi ${e.first_name},</p>
            <p style="font-size:14px;color:#4A5568;line-height:1.6">
              Thank you so much for your interest in Branscombe Estate! We're excited to have you on board and we'll make sure to keep you updated every step of the way.
            </p>
            <p style="font-size:14px;color:#4A5568;line-height:1.6">
              We've noted your interest in the following home(s):
            </p>
            <div style="background:#F5F3EE;padding:16px 20px;margin:16px 0;font-size:16px;font-weight:bold;color:#1A2744">
              ${unitList}
            </div>

            <h3 style="color:#1A2744;font-size:15px;margin:24px 0 8px">What happens next?</h3>
            <ul style="font-size:14px;color:#4A5568;line-height:1.8;padding-left:20px">
              <li>We'll send you <strong>monthly progress updates</strong> on the development so you're always in the loop.</li>
              <li>Construction is expected to commence in <strong>2026</strong>, with an estimated completion timeframe of <strong>late 2027 to mid-2028</strong>.</li>
              <li>As we get within <strong>6 months of completion</strong>, we'll reach out to you personally to discuss next steps, contracts, and settlement timing.</li>
            </ul>

            <p style="font-size:14px;color:#4A5568;line-height:1.6;margin-top:16px">
              This is a registration of interest only — no deposit or commitment is required at this stage. You're under no obligation, and we simply want to make sure you have first access to updates and opportunities as the project progresses.
            </p>

            <div style="background:#E6FAF9;border-left:4px solid #00B5AD;padding:16px 20px;margin:20px 0">
              <p style="font-size:14px;color:#1A2744;margin:0;line-height:1.6">
                <strong>Have questions?</strong> We'd love to hear from you. Feel free to reach out anytime — we're here to help.
              </p>
            </div>

            <p style="font-size:14px;color:#4A5568;line-height:1.6">
              Dennis McMahon<br>
              <a href="mailto:dennis@factory2key.com.au" style="color:#00B5AD">dennis@factory2key.com.au</a><br>
              <a href="tel:+61402612471" style="color:#00B5AD">+61 402 612 471</a>
            </p>
            <p style="font-size:14px;color:#1A2744;margin-top:24px">
              Warm regards,<br>
              <strong>The Factory2Key Team</strong>
            </p>
          </div>
          ${registrantAckFooterHtml(d.email)}
        </div>
      `,
    });
    if (confirmErr) console.error("branscombe applicant confirmation: Resend send error:", confirmErr);
  } catch (err) {
    console.error("Failed to send Branscombe ROI emails:", err);
  }

  // Forward to GHL CRM (best-effort — never blocks registration response).
  try {
    const ghlResult = await forwardRegistrationToGHL(
      {
        email: d.email,
        firstName: d.first_name,
        lastName: d.last_name,
        phone: d.phone,
        suburb: d.suburb,
        postcode: d.postcode,
        buyerType: d.buyer_type,
        buyerProfile: d.buyer_profile,
        currentHousing: d.current_housing,
        purchaseTimeline: d.purchase_timeline,
        financeStatus: d.finance_status,
        howHeard: d.how_heard,
        itemsSelected: d.units_selected,
        pricePreferences: d.price_preferences,
        referrerType: d.referrer_type,
        referrerName: d.referrer_name,
        referrerCompany: d.referrer_company,
        referrerContact: d.referrer_contact,
        notes: d.notes,
      },
      "branscombe",
    );
    if (ghlResult.error) {
      console.error("GHL forward failed (Branscombe ROI):", ghlResult.error);
    } else if (!ghlResult.skipped) {
      await supabase.from("audit_log").insert({
        actor_id: null,
        actor_email: d.email,
        action: "ghl_contact_forwarded",
        entity_type: "branscombe_registration",
        entity_id: ghlResult.contactId ?? null,
        details: {
          project: "branscombe",
          contact_id: ghlResult.contactId,
          created: ghlResult.created,
          email: d.email,
        },
      });
    }
  } catch (err) {
    console.error("GHL forward threw:", err);
  }

  return NextResponse.json({ success: true });
}
