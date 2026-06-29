import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { z } from "zod";
import { registrationsMaintenanceGuard } from "@/lib/maintenance";
import { createSupabaseService } from "@/lib/supabase-service";
import { escapeHtml } from "@/lib/html-escape";
import { getActiveRecipients, renderBrandedEmail } from "@/lib/branscombe/notify";
import { guardRecipients } from "@/lib/email/recipient-guard";
import { registrantAckFooterHtml } from "@/lib/email/unsubscribe";
import { firstTouchCookieName, parseFirstTouch } from "@/lib/attribution/first-touch";

/**
 * ROI portal — artefact 1: the light waitlist registration (spec §3/§7).
 *
 * Top-of-funnel, low-friction: name, mobile, email, buyer category + consent. Attribution
 * is NOT typed — it is read from the signed first-touch cookie the resolver set
 * (/r/<estate>?ref=TOKEN) and written immutably (migration 0063's trigger then locks it).
 * No-cookie arrivals land in the unassigned pool (NULL agent), per spec §4.
 */

const BUYER_CATEGORIES = ["owner-occupier", "investor", "first-home-buyer"] as const;

const schema = z.object({
  estate: z.string().min(1).max(50),
  name: z.string().min(1, "Please enter your name").max(120),
  email: z.string().email("Please enter a valid email address"),
  mobile: z.string().max(40).nullable().optional(),
  buyer_category: z.enum(BUYER_CATEGORIES, {
    errorMap: () => ({ message: "Please choose what best describes you" }),
  }),
  // Privacy consent is a hard gate to submit (spec §11.2). Contact consent is optional
  // and gates the 48h nudge (Phase 3).
  consent_privacy: z.literal(true, {
    errorMap: () => ({ message: "Please acknowledge the privacy collection notice" }),
  }),
  consent_contact: z.boolean().optional().default(false),
  // Anti-bot. honeypot accepts ANY value and is silently no-op'd server-side (never a 400,
  // never a silent drop of a real submit); the time-trap is the primary signal.
  hp_field: z.string().optional(),
  elapsed_ms: z.number().optional(),
});

export async function POST(request: Request) {
  const paused = registrationsMaintenanceGuard();
  if (paused) return paused;

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }
  const d = parsed.data;

  // Bot traps (server-side so a real submit is never silently dropped client-side).
  // Honeypot filled OR implausibly fast => accept the request shape but do not write.
  const isBot =
    (typeof d.hp_field === "string" && d.hp_field.trim() !== "") ||
    (typeof d.elapsed_ms === "number" && d.elapsed_ms < 2500);
  if (isBot) {
    console.warn("roi waitlist bot trap:", {
      estate: d.estate,
      hp: !!d.hp_field?.trim(),
      elapsed: d.elapsed_ms,
    });
    return NextResponse.json({ success: true });
  }

  const supabase = createSupabaseService();

  // Resolve the estate (config-driven; spec §5/§8).
  const { data: estate } = await (supabase.from("estates") as any)
    .select("id, slug, name, terms_version")
    .eq("slug", d.estate.toLowerCase())
    .maybeSingle();
  if (!estate) {
    return NextResponse.json({ error: "Unknown estate" }, { status: 400 });
  }

  // First-touch attribution from the signed cookie the resolver set. Never typed by the buyer.
  const cookieStore = cookies();
  const ft = parseFirstTouch(
    cookieStore.get(firstTouchCookieName(estate.slug))?.value,
  );
  let introducingAgentId: string | null = null;
  let introducingAgencyId: string | null = null;
  let firstTouchAt: string | null = null;
  if (ft && ft.estate === estate.slug) {
    // Defensive: only attribute to an agent that still exists (FK safety).
    const { data: agent } = await (supabase.from("agents") as any)
      .select("id")
      .eq("id", ft.agentId)
      .maybeSingle();
    if (agent) {
      introducingAgentId = ft.agentId;
      introducingAgencyId = ft.agencyId;
      firstTouchAt = ft.firstTouchAt;
    }
  }

  const hdrs = headers();
  const submitterIp =
    hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const userAgent = hdrs.get("user-agent") || null;

  const { data: row, error } = await (supabase.from("waitlist_registrations") as any)
    .insert({
      estate_id: estate.id,
      introducing_agency_id: introducingAgencyId,
      introducing_agent_id: introducingAgentId,
      first_touch_at: firstTouchAt,
      name: d.name.trim(),
      email: d.email.trim().toLowerCase(),
      mobile: d.mobile?.trim() || null,
      buyer_category: d.buyer_category,
      consent_contact: d.consent_contact ?? false,
      consent_privacy: true,
      terms_version: estate.terms_version ?? null,
      submitter_ip: submitterIp,
      user_agent: userAgent,
      status: "new",
    })
    .select("id")
    .single();

  if (error) {
    console.error("roi waitlist insert error:", error);
    return NextResponse.json(
      { error: "Registration failed. Please try again." },
      { status: 500 },
    );
  }

  await supabase.from("audit_log").insert({
    actor_id: null,
    actor_email: d.email,
    action: "roi_waitlist_submitted",
    entity_type: "waitlist_registration",
    entity_id: row.id,
    details: {
      estate: estate.slug,
      name: d.name,
      buyer_category: d.buyer_category,
      attributed: !!introducingAgentId,
      consent_contact: d.consent_contact ?? false,
    },
  });

  // Notifications — best-effort, never block the response.
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    const from =
      process.env.RESEND_FROM_EMAIL ||
      "Branscombe Estate <noreply@updates.corporateaisolutions.com>";
    const e = {
      name: escapeHtml(d.name),
      email: escapeHtml(d.email),
      emailHref: encodeURIComponent(d.email),
      mobile: escapeHtml(d.mobile ?? ""),
      category: escapeHtml(d.buyer_category),
      estateName: escapeHtml(estate.name),
    };

    // Admin notification.
    const recipients = await getActiveRecipients();
    const adminRows: Array<{ label: string; value: string }> = [
      { label: "Registrant", value: `<strong>${e.name}</strong>` },
      {
        label: "Email",
        value: `<a href="mailto:${e.emailHref}" style="color:#1A2744">${e.email}</a>`,
      },
    ];
    if (d.mobile) adminRows.push({ label: "Mobile", value: e.mobile });
    adminRows.push({ label: "Buyer category", value: e.category });
    adminRows.push({
      label: "Introducing agent",
      value: introducingAgentId
        ? "Attributed (see admin)"
        : "<span style=\"color:#94A3B8\">Unassigned pool</span>",
    });
    const adminHtml = renderBrandedEmail({
      preheader: `${d.name} joined the ${estate.name} waitlist`,
      heading: `New waitlist registration — ${e.estateName}`,
      intro: `${e.name} joined the ${e.estateName} waitlist.`,
      rows: adminRows,
      ctaLabel: "Open in admin",
      ctaHref: "https://f2k-projects.vercel.app/admin/branscombe-pipeline",
      footer:
        "Waitlist registration (top of funnel) — no deposit taken. Qualify the buyer, then send them the full registration form.",
    });
    const adminGuard = guardRecipients(recipients, { triggeredByEmail: d.email });
    const { error: adminErr } = await resend.emails.send({
      to: adminGuard.to,
      from,
      subject: `New ${estate.name} waitlist registration — ${d.name}`,
      html: adminHtml,
    });
    if (adminErr) console.error("roi waitlist admin notification: Resend send error:", adminErr);

    // Applicant confirmation.
    const confirmGuard = guardRecipients(d.email, { triggeredByEmail: d.email });
    const { error: confirmErr } = await resend.emails.send({
      to: confirmGuard.to,
      from,
      subject: `${estate.name} — you're on the waitlist`,
      html: `
        <div style="max-width:600px;font-family:sans-serif">
          <div style="background:#1A2744;padding:24px 32px">
            <h1 style="color:#FFFFFF;margin:0;font-size:24px">${e.estateName}</h1>
            <p style="color:#00B5AD;margin:4px 0 0;font-size:13px">A Factory2Key Development</p>
          </div>
          <div style="padding:32px;background:#FFFFFF">
            <p style="font-size:16px;color:#1A2744">Hi ${e.name},</p>
            <p style="font-size:14px;color:#4A5568;line-height:1.6">
              Thanks for registering your interest in ${e.estateName}. You're on the waitlist —
              we'll keep you updated, and when you're ready your agent will help you note your
              preferred home(s) and terms. This is a registration of interest only: no deposit,
              no obligation.
            </p>
            <p style="font-size:14px;color:#4A5568;line-height:1.6">
              Questions? Just reply to this email.
            </p>
            <p style="font-size:14px;color:#1A2744;margin-top:24px">
              Warm regards,<br><strong>The Factory2Key Team</strong>
            </p>
          </div>
          ${registrantAckFooterHtml(d.email)}
        </div>
      `,
    });
    if (confirmErr) console.error("roi waitlist applicant confirmation: Resend send error:", confirmErr);
  } catch (err) {
    console.error("roi waitlist email failed:", err);
  }

  // Note: CRM (GHL) forwarding carries the rich unit/price signals and belongs with the
  // agent-triggered qualification form (artefact 2), not this light waitlist.

  return NextResponse.json({ success: true });
}
