import { NextResponse } from "next/server";
import { registrationsMaintenanceGuard } from "@/lib/maintenance";
import { createSupabaseService } from "@/lib/supabase-service";
import { escapeHtml } from "@/lib/html-escape";
import { guardRecipients } from "@/lib/email/recipient-guard";
import { getActiveFunderRecipients } from "@/lib/funder/notify";
import { registrantAckFooterHtml } from "@/lib/email/unsubscribe";
import { z } from "zod";

export const dynamic = "force-dynamic";

const BUCKET = "funder-registrations";
const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25MB
const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/octet-stream",
]);

const detailsSchema = z.object({
  project_slug: z.string().max(120).nullable().optional(),
  lender_type: z.enum(["senior", "junior"]),
  org_name: z.string().min(1, "Bank / institution name is required").max(300),
  contact_name: z.string().min(1, "Contact name is required").max(200),
  role_title: z.string().max(200).nullable().optional(),
  email: z.string().email("Please enter a valid email address").max(300),
  mobile: z.string().max(60).nullable().optional(),
  division: z.string().max(200).nullable().optional(),
  registered_bank_confirmed: z.literal(true, {
    errorMap: () => ({
      message:
        "Please confirm your institution is a registered Australian bank / APRA-authorised ADI",
    }),
  }),
  indicative_pct: z.number().min(0).max(100).nullable().optional(),
  indicative_amount: z.number().nonnegative().nullable().optional(),
  package_amount_at_submit: z.number().nonnegative().nullable().optional(),
  preferred_structure: z.string().max(4000).nullable().optional(),
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
  // Honeypot — must be empty.
  // Honeypot — accept any value (don't 400 a real user whose browser autofilled it);
  // a filled value is silently dropped below. The field name is autofill-neutral.
  hp_field: z.string().optional(),
});

function extFromName(name: string): string {
  const m = name.match(/\.([a-zA-Z0-9]{1,8})$/);
  return m ? m[1].toLowerCase() : "bin";
}

export async function POST(request: Request) {
  const paused = registrationsMaintenanceGuard();
  if (paused) return paused;

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json(
      { error: "Expected multipart/form-data" },
      { status: 400 },
    );
  }

  const raw = formData.get("data");
  if (typeof raw !== "string") {
    return NextResponse.json({ error: "Missing form data" }, { status: 400 });
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Malformed form data" }, { status: 400 });
  }

  const parsed = detailsSchema.safeParse(json);
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

  // Junior tranche bounds (server-side guard mirroring the form).
  if (
    d.lender_type === "junior" &&
    d.indicative_pct != null &&
    (d.indicative_pct < 10 || d.indicative_pct > 50)
  ) {
    return NextResponse.json(
      { error: "A junior tranche is between 10% and 50% of the package." },
      { status: 400 },
    );
  }

  const supabase = createSupabaseService();

  // ---- Optional single upload (mandate / term sheet / capacity statement) ----
  let uploadUrl: string | null = null;
  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: "The attached file is larger than 25MB." },
        { status: 400 },
      );
    }
    if (file.type && !ALLOWED_MIME.has(file.type)) {
      return NextResponse.json(
        { error: "Please attach a PDF." },
        { status: 400 },
      );
    }
    const ext = extFromName(file.name);
    const safeBase =
      file.name
        .replace(/\.[^.]+$/, "")
        .replace(/[^a-zA-Z0-9-_]+/g, "-")
        .slice(0, 60) || "document";
    const submissionId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const storagePath = `${submissionId}/${safeBase}.${ext}`;
    const arrayBuffer = await file.arrayBuffer();
    const uploadRes = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, arrayBuffer, {
        contentType: file.type || "application/pdf",
        upsert: false,
      });
    if (uploadRes.error) {
      console.error("Funder registration upload failed:", uploadRes.error.message);
    } else {
      const { data: publicData } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(storagePath);
      uploadUrl = publicData.publicUrl;
    }
  }

  // ---- Persist the registration (one row) ----
  const { data: inserted, error } = await (
    supabase.from("funder_registrations") as any
  )
    .insert({
      project_slug: d.project_slug ?? null,
      lender_type: d.lender_type,
      org_name: d.org_name,
      contact_name: d.contact_name,
      role_title: d.role_title ?? null,
      email: d.email,
      mobile: d.mobile ?? null,
      division: d.division ?? null,
      registered_bank_confirmed: d.registered_bank_confirmed,
      indicative_pct: d.indicative_pct ?? null,
      indicative_amount: d.indicative_amount ?? null,
      package_amount_at_submit: d.package_amount_at_submit ?? null,
      preferred_structure: d.preferred_structure ?? null,
      upload_url: uploadUrl,
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
    console.error("Funder registration insert error:", error);
    return NextResponse.json(
      { error: "Registration failed. Please try again." },
      { status: 500 },
    );
  }

  // Audit log (best-effort).
  try {
    await supabase.from("audit_log").insert({
      actor_id: null,
      actor_email: d.email,
      action: "funder_registration_submitted",
      entity_type: "funder_registration",
      entity_id: inserted?.id ?? null,
      details: {
        org: d.org_name,
        lender_type: d.lender_type,
        project: d.project_slug ?? null,
        indicative_pct: d.indicative_pct ?? null,
        indicative_amount: d.indicative_amount ?? null,
      },
    });
  } catch (err) {
    console.error("Funder registration audit log failed:", err);
  }

  // ---- Notify the F2K team + confirm to the funder (best-effort, never blocks) ----
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    const from =
      process.env.RESEND_FROM_EMAIL || "Factory2Key <onboarding@resend.dev>";

    const recipients = await getActiveFunderRecipients();
    const guard = guardRecipients(recipients, { triggeredByEmail: d.email });

    const fmtAud = (n?: number | null) =>
      n != null ? "$" + Math.round(n).toLocaleString("en-AU") : "";

    const e = {
      org_name: escapeHtml(d.org_name),
      contact_name: escapeHtml(d.contact_name),
      role_title: escapeHtml(d.role_title),
      email: escapeHtml(d.email),
      mobile: escapeHtml(d.mobile),
      division: escapeHtml(d.division),
      preferred_structure: escapeHtml(d.preferred_structure),
      project_slug: escapeHtml(d.project_slug),
    };

    const lenderLabel =
      d.lender_type === "senior"
        ? "Senior (50% + retail FRoR)"
        : `Junior (${d.indicative_pct ?? "?"}%)`;

    const row = (label: string, value: string) =>
      value
        ? `<tr><td style="padding:4px 12px;color:#666;vertical-align:top">${label}</td><td style="padding:4px 12px;color:#142C44">${value}</td></tr>`
        : "";

    const transcript = d.voice_transcript?.length
      ? d.voice_transcript
          .map(
            (m) =>
              `<p style="margin:4px 0"><strong style="color:${m.role === "assistant" ? "#C77F3A" : "#142C44"}">${m.role === "assistant" ? "Sloane" : "Funder"}:</strong> ${escapeHtml(m.content)}</p>`,
          )
          .join("")
      : "";

    const adminHtml = `
      <div style="max-width:640px;font-family:sans-serif">
        <div style="background:#142C44;padding:24px 32px">
          <h1 style="color:#fff;margin:0;font-size:22px">New Funder Registration</h1>
          <p style="color:#C77F3A;margin:4px 0 0;font-size:13px">${e.org_name} — ${lenderLabel}${d.project_slug ? ` · ${e.project_slug}` : ""}</p>
        </div>
        <div style="padding:24px 32px;background:#fff">
          <table style="border-collapse:collapse;font-size:14px;width:100%">
            ${row("Lender type", lenderLabel)}
            ${row("Bank / institution", `<strong>${e.org_name}</strong>`)}
            ${row("Registered-bank confirmed", d.registered_bank_confirmed ? "Yes" : "No")}
            ${row("Contact", `<strong>${e.contact_name}</strong>`)}
            ${row("Role / title", e.role_title)}
            ${row("Email", `<a href="mailto:${encodeURIComponent(d.email)}" style="color:#142C44">${e.email}</a>`)}
            ${row("Mobile", e.mobile)}
            ${row("Division / desk", e.division)}
            ${row("Project", e.project_slug)}
            ${row("Indicative %", d.indicative_pct != null ? `${d.indicative_pct}%` : "")}
            ${row("Indicative amount", fmtAud(d.indicative_amount))}
            ${row("Package at submit", fmtAud(d.package_amount_at_submit))}
            ${row("Document", uploadUrl ? `<a href="${uploadUrl}" style="color:#C77F3A">View attachment</a>` : "")}
          </table>
          ${e.preferred_structure ? `<h3 style="color:#142C44;font-size:14px;margin:20px 0 4px">Preferred structure / conditions</h3><p style="font-size:14px;color:#4A5568;line-height:1.6;white-space:pre-wrap">${e.preferred_structure}</p>` : ""}
          ${transcript ? `<h3 style="color:#142C44;font-size:14px;margin:20px 0 4px">Voice discovery (Sloane)</h3><div style="font-size:13px;color:#4A5568;line-height:1.5;background:#F8FAFC;padding:12px 16px;border-radius:6px">${transcript}</div>` : ""}
        </div>
        <div style="background:#F5F3EE;padding:16px 32px;font-size:11px;color:#999">
          Registration of interest from a registered Australian bank via the Factory2Key funder pages. Not an offer; subject to formal terms + due diligence.${guard.rerouted ? ` [rerouted: ${guard.reason}; intended ${guard.original.join(", ")}]` : ""}
        </div>
      </div>`;

    const { error: adminErr } = await resend.emails.send({
      from,
      to: guard.to,
      subject: `New funder registration — ${d.org_name} (${lenderLabel})`,
      html: adminHtml,
    });
    if (adminErr) console.error("funder admin notification: Resend send error:", adminErr);

    // Confirmation to the funder.
    const confirmGuard = guardRecipients([d.email], { triggeredByEmail: d.email });
    const { error: confirmErr } = await resend.emails.send({
      from,
      to: confirmGuard.to,
      subject: "Factory2Key — your funding interest is registered",
      html: `
        <div style="max-width:600px;font-family:sans-serif">
          <div style="background:#142C44;padding:24px 32px">
            <h1 style="color:#fff;margin:0;font-size:22px">Factory2Key · Funders</h1>
          </div>
          <div style="padding:32px;background:#fff">
            <p style="font-size:16px;color:#142C44">Hi ${escapeHtml(d.contact_name.split(" ")[0] || d.contact_name)},</p>
            <p style="font-size:14px;color:#4A5568;line-height:1.6">
              Thank you for registering ${e.org_name}&apos;s indicative interest as a <strong>${lenderLabel.toLowerCase()}</strong> lender${d.project_slug ? ` in ${e.project_slug}` : ""}. Dennis will be in touch to walk through the term sheet and next steps.
            </p>
            <p style="font-size:14px;color:#4A5568;line-height:1.6">
              This is a registration of interest only — it is not an offer or invitation, creates no obligation on either side, and any participation is subject to formal documentation and due diligence.
            </p>
            <p style="font-size:14px;color:#142C44;margin-top:24px">
              Kind regards,<br><strong>The Factory2Key Team</strong>
            </p>
          </div>
          ${registrantAckFooterHtml(d.email)}
        </div>`,
    });
    if (confirmErr) console.error("funder confirmation: Resend send error:", confirmErr);
  } catch (err) {
    console.error("Failed to send funder registration emails:", err);
  }

  return NextResponse.json({ success: true });
}
