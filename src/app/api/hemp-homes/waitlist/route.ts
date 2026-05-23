import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createSupabaseService } from "@/lib/supabase-service";
import { escapeHtml } from "@/lib/html-escape";
import { checkRateLimit } from "@/lib/rate-limit";
import { forwardRegistrationToGHL } from "@/lib/ghl";
import {
  getActiveRecipients,
  renderBrandedEmail,
} from "@/lib/hemp-homes/notify";
import { z } from "zod";

const PROGRAM_SLUG = "hemp-homes-for-eco-communities";

const AU_STATES = ["QLD", "NSW", "VIC", "TAS", "SA", "WA", "ACT", "NT"] as const;

const schema = z.object({
  // contact
  full_name: z.string().min(1, "Full name is required").max(200),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().max(30).nullable().optional(),
  suburb: z.string().max(100).nullable().optional(),
  state: z.enum(AU_STATES).nullable().optional(),
  postcode: z.string().max(4).nullable().optional(),

  // interest profile
  i_am_a: z.string().max(100).nullable().optional(),
  situation: z.string().max(100).nullable().optional(),
  timeframe: z.string().max(50).nullable().optional(),
  finance_status: z.string().max(50).nullable().optional(),
  hear_about: z.string().max(50).nullable().optional(),

  // program-specific
  regions_of_interest: z.array(z.string().max(40)).max(20).default([]),
  preferred_config: z.string().max(50).nullable().optional(),
  build_preference: z
    .enum(["owner_builder", "built_for_you", "not_sure"])
    .nullable()
    .optional(),
  journey_interests: z.array(z.string().max(40)).max(20).default([]),
  what_drew_you: z.string().max(2000).nullable().optional(),

  // referrer (optional)
  referrer_type: z.string().max(50).nullable().optional(),
  referrer_name: z.string().max(200).nullable().optional(),
  referrer_company: z.string().max(200).nullable().optional(),
  referrer_contact: z.string().max(200).nullable().optional(),

  notes: z.string().max(2000).nullable().optional(),

  consent: z.literal(true, {
    errorMap: () => ({
      message: "You must acknowledge this is a registration of interest only",
    }),
  }),
});

function hashIp(ip: string | null, salt: string | undefined): string | null {
  if (!ip || !salt) return null;
  return createHash("sha256").update(`${ip}${salt}`).digest("hex");
}

function getClientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() ?? null;
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return null;
}

export async function POST(request: Request) {
  const fromAddress = process.env.RESEND_FROM_EMAIL_HEMP_HOMES;
  if (!fromAddress) {
    console.error(
      "Hemp Homes waitlist: RESEND_FROM_EMAIL_HEMP_HOMES is not set; refusing to submit.",
    );
    return NextResponse.json(
      { error: "Submissions are temporarily unavailable. Please try again later." },
      { status: 500 },
    );
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid submission." },
      { status: 400 },
    );
  }
  const d = parsed.data;

  // Rate limit: 5 / hour / IP. Bypass when no IP (server-to-server tests).
  const ip = getClientIp(request);
  const ipHash = hashIp(ip, process.env.IP_HASH_SALT);
  if (ipHash) {
    const rl = checkRateLimit(`hemp-homes:${ipHash}`, 5, 3_600_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "You've submitted recently. Try again in a few minutes." },
        { status: 429 },
      );
    }
  }

  const supabase = createSupabaseService();
  const userAgent = request.headers.get("user-agent");

  // Silent dedupe via UNIQUE(email, program_slug). If conflict, the inserted
  // row is the existing one and we skip side-effects (email, GHL). The
  // submitter sees identical success either way — no membership-probing oracle.
  const { data: inserted, error: insertError } = await (
    supabase.from("hemp_homes_waitlist") as any
  )
    .upsert(
      {
        program_slug: PROGRAM_SLUG,
        full_name: d.full_name,
        email: d.email,
        phone: d.phone ?? null,
        suburb: d.suburb ?? null,
        state: d.state ?? null,
        postcode: d.postcode ?? null,
        i_am_a: d.i_am_a ?? null,
        situation: d.situation ?? null,
        timeframe: d.timeframe ?? null,
        finance_status: d.finance_status ?? null,
        hear_about: d.hear_about ?? null,
        regions_of_interest: d.regions_of_interest,
        preferred_config: d.preferred_config ?? null,
        build_preference: d.build_preference ?? null,
        journey_interests: d.journey_interests,
        what_drew_you: d.what_drew_you ?? null,
        referrer_type: d.referrer_type ?? null,
        referrer_name: d.referrer_name ?? null,
        referrer_company: d.referrer_company ?? null,
        referrer_contact: d.referrer_contact ?? null,
        notes: d.notes ?? null,
        consent_at: new Date().toISOString(),
        source: "web-roi",
        user_agent: userAgent,
        ip_hash: ipHash,
      },
      {
        onConflict: "email,program_slug",
        ignoreDuplicates: true,
      },
    )
    .select("id")
    .maybeSingle();

  if (insertError) {
    console.error("Hemp Homes waitlist insert error:", insertError);
    return NextResponse.json(
      { error: "Registration failed. Please try again." },
      { status: 500 },
    );
  }

  const deduped = inserted == null;

  // Audit log — uses the same actor_email convention as Seafields/Branscombe.
  await supabase.from("audit_log").insert({
    actor_id: null,
    actor_email: d.email,
    action: "hemp_homes_waitlist_submitted",
    entity_type: "hemp_homes_waitlist",
    entity_id: inserted?.id ?? null,
    details: {
      program: PROGRAM_SLUG,
      regions: d.regions_of_interest,
      preferred_config: d.preferred_config,
      build_preference: d.build_preference,
      journey_interests: d.journey_interests,
      timeframe: d.timeframe,
      i_am_a: d.i_am_a,
      situation: d.situation,
      finance_status: d.finance_status,
      referrer: d.referrer_name
        ? `${d.referrer_name} (${d.referrer_type})`
        : null,
      location: d.suburb
        ? `${d.suburb} ${d.postcode || ""}`.trim()
        : null,
      deduped,
    },
  });

  // On dedupe: skip email + GHL side-effects. Return identical success shape.
  if (deduped) {
    return NextResponse.json({ success: true });
  }

  const rowId = inserted?.id ?? null;

  // Resend — admin notification + applicant confirmation. All user-controlled
  // fields HTML-escaped via the `e` map.
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);

    const e = {
      full_name: escapeHtml(d.full_name),
      email: escapeHtml(d.email),
      emailHref: encodeURIComponent(d.email),
      phone: escapeHtml(d.phone),
      suburb: escapeHtml(d.suburb),
      state: escapeHtml(d.state),
      postcode: escapeHtml(d.postcode),
      i_am_a: escapeHtml(d.i_am_a),
      situation: escapeHtml(d.situation),
      timeframe: escapeHtml(d.timeframe),
      finance_status: escapeHtml(d.finance_status),
      hear_about: escapeHtml(d.hear_about),
      preferred_config: escapeHtml(d.preferred_config),
      build_preference: escapeHtml(
        d.build_preference === "owner_builder"
          ? "Owner-builder (community help)"
          : d.build_preference === "built_for_you"
            ? "Built for you (F2K supplies team)"
            : d.build_preference === "not_sure"
              ? "Not sure yet"
              : null,
      ),
      what_drew_you: escapeHtml(d.what_drew_you),
      notes: escapeHtml(d.notes),
      regions: d.regions_of_interest.map(escapeHtml).join(", "),
      journey_interests: d.journey_interests.map(escapeHtml).join(", "),
    };

    const referrerRow = d.referrer_name
      ? `<tr><td style="padding:4px 12px;color:#666">Referrer</td><td style="padding:4px 12px">${escapeHtml(d.referrer_name)}${d.referrer_company ? ` — ${escapeHtml(d.referrer_company)}` : ""}${d.referrer_contact ? ` (${escapeHtml(d.referrer_contact)})` : ""} [${escapeHtml(d.referrer_type)}]</td></tr>`
      : "";

    // Admin notification — recipients from DB (managed at /admin/hemp-homes).
    // Branded template matching Seafields + Branscombe.
    const recipients = await getActiveRecipients();

    const adminRows: Array<{ label: string; value: string }> = [
      { label: "Name", value: `<strong>${e.full_name}</strong>` },
      {
        label: "Email",
        value: `<a href="mailto:${e.emailHref}" style="color:#1A2744">${e.email}</a>`,
      },
    ];
    if (d.phone) adminRows.push({ label: "Phone", value: e.phone });
    if (d.suburb || d.state || d.postcode)
      adminRows.push({
        label: "Location",
        value: [e.suburb, e.state, e.postcode].filter(Boolean).join(" "),
      });
    if (d.i_am_a) adminRows.push({ label: "I am a", value: e.i_am_a });
    if (d.situation) adminRows.push({ label: "Situation", value: e.situation });
    if (d.timeframe) adminRows.push({ label: "Timeframe", value: e.timeframe });
    if (d.finance_status)
      adminRows.push({ label: "Finance", value: e.finance_status });
    if (d.hear_about)
      adminRows.push({ label: "How heard", value: e.hear_about });
    if (d.preferred_config)
      adminRows.push({ label: "Preferred config", value: e.preferred_config });
    if (e.build_preference)
      adminRows.push({
        label: "Build model",
        value: `<strong>${e.build_preference}</strong>`,
      });
    if (e.regions) adminRows.push({ label: "Regions", value: e.regions });
    if (e.journey_interests)
      adminRows.push({ label: "Journey interest", value: e.journey_interests });
    if (d.what_drew_you)
      adminRows.push({
        label: "What drew them",
        value: `<em>${e.what_drew_you}</em>`,
      });
    if (referrerRow) {
      const referrerText =
        `${d.referrer_name ? escapeHtml(d.referrer_name) : ""}` +
        `${d.referrer_company ? ` — ${escapeHtml(d.referrer_company)}` : ""}` +
        `${d.referrer_contact ? ` (${escapeHtml(d.referrer_contact)})` : ""}` +
        ` <span style="color:#94A3B8">[${escapeHtml(d.referrer_type || "")}]</span>`;
      adminRows.push({ label: "Referrer", value: referrerText });
    }
    if (d.notes) adminRows.push({ label: "Notes", value: e.notes });

    const adminHtml = renderBrandedEmail({
      preheader: `${d.full_name} registered for Hemp Homes waitlist`,
      heading: `Another waitlist registration by ${d.full_name}`,
      intro: `${escapeHtml(d.full_name)} just signed up for the Hemp Homes for Eco-Communities waitlist.`,
      rows: adminRows,
      ctaLabel: "Open admin",
      ctaHref: "https://f2k-projects.vercel.app/admin/hemp-homes",
      footer:
        "Waitlist signup only — no deposit taken. Reply directly to the applicant from your inbox or follow up via the admin panel.",
    });

    await resend.emails.send({
      from: fromAddress,
      to: recipients,
      subject: `Another waitlist signup by ${d.full_name}`,
      html: adminHtml,
    });

    // Applicant confirmation — forest accent (#1B4332) per DESIGN.md §11.
    await resend.emails.send({
      from: fromAddress,
      to: d.email,
      subject: "Hemp Homes — You're on the waitlist",
      html: `
        <div style="max-width:600px;font-family:sans-serif">
          <div style="background:#1A2744;padding:24px 32px">
            <h1 style="color:#FFFFFF;margin:0;font-size:24px">Hemp Homes for Eco-Communities</h1>
            <p style="color:#1B4332;background:#FAF7F2;display:inline-block;margin:8px 0 0;padding:2px 8px;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;font-weight:bold">A Factory2Key program</p>
          </div>
          <div style="padding:32px;background:#FFFFFF">
            <p style="font-size:16px;color:#1A2744">Hi ${e.full_name},</p>
            <p style="font-size:14px;color:#4A5568;line-height:1.6">
              Thanks for joining the waitlist. You'll hear from us at each major milestone — concept design, panel mockups, engineering tests, prototype builds, certification, the first install.
            </p>
            <p style="font-size:14px;color:#4A5568;line-height:1.6">
              This is a registration of interest only. No deposit, no commitment, unsubscribe any time.
            </p>
            <div style="border-left:3px solid #1B4332;padding:12px 16px;margin:20px 0;background:#FAF7F2">
              <p style="font-size:14px;color:#1A2744;margin:0;line-height:1.6">
                <strong>What's next.</strong> We're publishing the build openly on the journey timeline as it happens. Check back any time, or watch your inbox.
              </p>
            </div>
            <p style="font-size:14px;color:#4A5568;line-height:1.6">
              Questions? Reply to this email or reach Dennis directly at
              <a href="mailto:dennis@factory2key.com.au" style="color:#1B4332">dennis@factory2key.com.au</a>.
            </p>
            <p style="font-size:14px;color:#1A2744;margin-top:24px">
              Warm regards,<br>
              <strong>The Factory2Key Team</strong>
            </p>
          </div>
          <div style="background:#F5F3EE;padding:16px 32px;font-size:11px;color:#999;line-height:1.6">
            Hemp Homes for Eco-Communities — In development, build in public<br>
            You're receiving this email because you joined the waitlist at factory2key.com.au.<br>
            Factory2Key Pty Ltd
          </div>
        </div>
      `,
    });

    if (rowId) {
      await (supabase.from("hemp_homes_waitlist") as any)
        .update({ confirmation_sent_at: new Date().toISOString() })
        .eq("id", rowId);
    }
  } catch (err) {
    console.error("Failed to send Hemp Homes waitlist emails:", err);
  }

  // Forward to GHL (best-effort).
  try {
    const ghlResult = await forwardRegistrationToGHL(
      {
        email: d.email,
        firstName: d.full_name.split(" ")[0] ?? d.full_name,
        lastName: d.full_name.split(" ").slice(1).join(" ") || "",
        phone: d.phone ?? null,
        suburb: d.suburb ?? null,
        postcode: d.postcode ?? null,
        buyerType: d.i_am_a ?? null,
        buyerProfile: d.situation ?? null,
        currentHousing: null,
        purchaseTimeline: d.timeframe ?? null,
        financeStatus: d.finance_status ?? null,
        howHeard: d.hear_about ?? null,
        itemsSelected: d.regions_of_interest,
        pricePreferences: null,
        referrerType: d.referrer_type ?? null,
        referrerName: d.referrer_name ?? null,
        referrerCompany: d.referrer_company ?? null,
        referrerContact: d.referrer_contact ?? null,
        notes: d.notes ?? null,
      },
      "hemp-homes",
    );
    if (ghlResult.error) {
      console.error("GHL forward failed (Hemp Homes waitlist):", ghlResult.error);
    } else if (!ghlResult.skipped) {
      if (rowId) {
        await (supabase.from("hemp_homes_waitlist") as any)
          .update({ ghl_synced_at: new Date().toISOString() })
          .eq("id", rowId);
      }
      await supabase.from("audit_log").insert({
        actor_id: null,
        actor_email: d.email,
        action: "ghl_contact_forwarded",
        entity_type: "hemp_homes_waitlist",
        entity_id: ghlResult.contactId ?? null,
        details: {
          project: "hemp-homes",
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
