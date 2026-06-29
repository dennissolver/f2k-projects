import { NextResponse } from "next/server";
import { registrationsMaintenanceGuard } from "@/lib/maintenance";
import { createSupabaseService } from "@/lib/supabase-service";
import { escapeHtml } from "@/lib/html-escape";
import { runPropertyCheck, propertyCheckEmailBlock } from "@/lib/property-check";
import { registrantAckFooterHtml } from "@/lib/email/unsubscribe";
import { z } from "zod";

export const dynamic = "force-dynamic";

const BUCKET = "developer-onboarding";
const MAX_FILES = 10;
const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25MB per file

// Plans / sketches / drawings / preferred house designs.
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/tiff",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "image/vnd.dwg",
  "application/acad",
  "application/octet-stream",
]);

const detailsSchema = z.object({
  developer_name: z.string().min(1, "Your name is required").max(200),
  email: z.string().email("Please enter a valid email address"),
  mobile: z.string().max(40).nullable().optional(),
  website: z.string().max(300).nullable().optional(),
  estate_name: z.string().min(1, "Estate / project name is required").max(200),
  estate_location: z.string().max(300).nullable().optional(),
  estate_postcode: z.string().max(12).nullable().optional(),
  estate_state: z.string().max(60).nullable().optional(),
  estate_lat: z.number().min(-90).max(90).nullable().optional(),
  estate_lng: z.number().min(-180).max(180).nullable().optional(),
  lot_plan_reference: z.string().max(500).nullable().optional(),
  site_area_value: z.number().nonnegative().max(1_000_000).nullable().optional(),
  site_area_unit: z.enum(["ha", "acres", "m2"]).nullable().optional(),
  dwellings_envisaged: z.string().max(120).nullable().optional(),
  zoning_status: z.string().max(200).nullable().optional(),
  vision: z.string().max(8000).nullable().optional(),
  deal_preferences: z.string().max(4000).nullable().optional(),
  // Deterministic intake — let the page + funder summary build with minimal LLM guessing.
  archetype: z.string().max(60).nullable().optional(),
  target_market: z.array(z.string().max(60)).max(20).optional(),
  land_uses: z.array(z.string().max(60)).max(20).optional(),
  lot_size_mix: z.string().max(500).nullable().optional(),
  why_attractive: z.string().max(4000).nullable().optional(),
  land_cost: z.number().nonnegative().max(1_000_000_000).nullable().optional(),
  market_value_note: z.string().max(4000).nullable().optional(),
  agents: z
    .array(
      z.object({
        name: z.string().max(200).optional(),
        agency: z.string().max(200).optional(),
        mobile: z.string().max(60).optional(),
        email: z.string().max(200).optional(),
      }),
    )
    .max(12)
    .optional(),
  // Commercial gate: F2K-as-estate-manager acknowledgement + authority to agree.
  terms_accepted: z.boolean().optional(),
  authority_confirmed: z.boolean().optional(),
  // Who is enquiring (developer / land owner / agent / …) + the real green-light gate.
  submitter_role: z.string().max(120).nullable().optional(),
  site_control: z.string().max(200).nullable().optional(),
  // Land owner details when the submitter isn't the owner (e.g. an agent on a client's behalf).
  landowner_details: z
    .object({
      name: z.string().max(200).optional(),
      email: z.string().max(200).optional(),
      phone: z.string().max(60).optional(),
      note: z.string().max(2000).optional(),
    })
    .nullable()
    .optional(),
  voice_transcript: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(4000),
      }),
    )
    .max(120)
    .optional(),
  // ElevenLabs conversation id (from the live Morgan session), so the server-captured
  // post-call transcript can be linked to this lead.
  voice_conversation_id: z.string().max(200).nullable().optional(),
  consent: z.literal(true, {
    errorMap: () => ({
      message: "Please confirm you're happy for us to contact you about your project",
    }),
  }),
  // Honeypot — must be empty.
  website_url: z.string().max(0).optional(),
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

  // Anti-bot (server-side). The TIME-TRAP is the only HARD block (false-positive-free). BOTH
  // honeypots (the legacy autofill-prone `website_url` and `hp_field`) are NON-BLOCKING + logged —
  // password managers autofill hidden fields, so a filled honeypot must never drop a real lead
  // (PRODUCT_STANDARDS; observed live: a real submit had the honeypot autofilled).
  if (d.website_url) {
    console.warn("developers onboarding: legacy website_url honeypot filled (non-blocking, likely autofill)");
  }
  const hp = String(formData.get("hp_field") || "");
  const elapsed = Number(formData.get("elapsed_ms") || 0);
  if (hp.trim() !== "") {
    console.warn("developers onboarding: honeypot filled (non-blocking, likely autofill)");
  }
  if (elapsed && elapsed < 2500) {
    console.warn("developers onboarding bot trap (time):", { elapsed });
    return NextResponse.json({ success: true });
  }

  const supabase = createSupabaseService();

  // ---- Upload files (best-effort per-file; a failed upload is skipped, not fatal) ----
  // Two groups: "files" = plans/sketches/designs; "title_files" = land title / certificate
  // of title (tagged so the team can spot the authoritative ownership document).
  type UploadEntry = {
    name: string;
    path: string;
    url: string;
    size: number;
    type: string;
    category: "plan" | "land_title";
  };
  const uploads: UploadEntry[] = [];
  const submissionId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  const groups: Array<{ field: string; category: UploadEntry["category"] }> = [
    { field: "files", category: "plan" },
    { field: "title_files", category: "land_title" },
  ];

  for (const group of groups) {
    const files = formData
      .getAll(group.field)
      .filter((f): f is File => f instanceof File && f.size > 0)
      .slice(0, MAX_FILES);

    for (const file of files) {
      if (uploads.length >= MAX_FILES) break;
      if (file.size > MAX_FILE_BYTES) continue;
      if (file.type && !ALLOWED_MIME.has(file.type)) continue;
      const ext = extFromName(file.name);
      const safeBase =
        file.name
          .replace(/\.[^.]+$/, "")
          .replace(/[^a-zA-Z0-9-_]+/g, "-")
          .slice(0, 60) || "file";
      const storagePath = `${submissionId}/${group.category}-${safeBase}-${uploads.length}.${ext}`;
      const arrayBuffer = await file.arrayBuffer();
      const uploadRes = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, arrayBuffer, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });
      if (uploadRes.error) {
        console.error("Developer onboarding upload failed:", uploadRes.error.message);
        continue;
      }
      const { data: publicData } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(storagePath);
      uploads.push({
        name: file.name,
        path: storagePath,
        url: publicData.publicUrl,
        size: file.size,
        type: file.type || "application/octet-stream",
        category: group.category,
      });
    }
  }

  // ---- Persist the submission ----
  const { data: inserted, error } = await (
    supabase.from("developer_onboarding") as any
  )
    .insert({
      developer_name: d.developer_name,
      email: d.email,
      mobile: d.mobile ?? null,
      website: d.website ?? null,
      estate_name: d.estate_name,
      estate_location: d.estate_location ?? null,
      estate_postcode: d.estate_postcode ?? null,
      estate_state: d.estate_state ?? null,
      estate_lat: d.estate_lat ?? null,
      estate_lng: d.estate_lng ?? null,
      lot_plan_reference: d.lot_plan_reference ?? null,
      site_area_value: d.site_area_value ?? null,
      site_area_unit: d.site_area_unit ?? null,
      dwellings_envisaged: d.dwellings_envisaged ?? null,
      zoning_status: d.zoning_status ?? null,
      vision: d.vision ?? null,
      deal_preferences: d.deal_preferences ?? null,
      archetype: d.archetype ?? null,
      target_market: d.target_market ?? [],
      land_uses: d.land_uses ?? [],
      lot_size_mix: d.lot_size_mix ?? null,
      why_attractive: d.why_attractive ?? null,
      land_cost: d.land_cost ?? null,
      market_value_note: d.market_value_note ?? null,
      agents: d.agents ?? [],
      terms_accepted_at: d.terms_accepted ? new Date().toISOString() : null,
      authority_confirmed: d.authority_confirmed ?? false,
      submitter_role: d.submitter_role ?? null,
      site_control: d.site_control ?? null,
      landowner_details: d.landowner_details ?? {},
      voice_transcript: d.voice_transcript ?? [],
      voice_conversation_id: d.voice_conversation_id ?? null,
      uploads,
      source: "web",
      status: "new",
    } as never)
    .select("id")
    .single();

  if (error) {
    console.error("Developer onboarding insert error:", error);
    // Roll back uploaded files so we don't leave orphans.
    if (uploads.length) {
      await supabase.storage
        .from(BUCKET)
        .remove(uploads.map((u) => u.path))
        .catch(() => {});
    }
    return NextResponse.json(
      { error: "Submission failed. Please try again." },
      { status: 500 },
    );
  }

  // Link the server-captured (post-call webhook) voice conversation to this lead, if any.
  if (d.voice_conversation_id && inserted?.id) {
    const { error: linkErr } = await (
      supabase.from("developer_voice_conversations") as any
    )
      .update({ onboarding_id: inserted.id } as never)
      .eq("conversation_id", d.voice_conversation_id);
    if (linkErr) {
      console.error("Developer onboarding voice-link failed:", linkErr.message);
    }
  }

  // Kickstart property analysis (best-effort, env-gated, time-bounded — never blocks).
  // Geocodes the location and pulls wind/bushfire/climate + zoning/LGA/overlays/yield so the
  // first-pass site DD lands with the enquiry. Stored on the row + shown in the admin email.
  let propertyCheck = null;
  try {
    propertyCheck = await runPropertyCheck(
      {
        estate_location: d.estate_location,
        estate_postcode: d.estate_postcode,
        estate_state: d.estate_state,
        estate_lat: d.estate_lat,
        estate_lng: d.estate_lng,
        lot_plan_reference: d.lot_plan_reference,
      },
      15_000,
    );
    if (inserted?.id) {
      await (supabase.from("developer_onboarding") as any)
        .update({ property_check: propertyCheck } as never)
        .eq("id", inserted.id);
    }
  } catch (err) {
    console.error("Developer onboarding property check failed:", err);
  }

  // Audit log (best-effort).
  try {
    await supabase.from("audit_log").insert({
      actor_id: null,
      actor_email: d.email,
      action: "developer_onboarding_submitted",
      entity_type: "developer_onboarding",
      entity_id: inserted?.id ?? null,
      details: {
        developer: d.developer_name,
        estate: d.estate_name,
        location: d.estate_location ?? null,
        uploads: uploads.length,
        voice_turns: d.voice_transcript?.length ?? 0,
      },
    });
  } catch (err) {
    console.error("Developer onboarding audit log failed:", err);
  }

  // ---- Notify the F2K team (best-effort — never blocks the response) ----
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);

    const notifyTo =
      process.env.DEVELOPER_ONBOARDING_NOTIFY_EMAIL ||
      "dennis@factory2key.com.au";
    const from =
      process.env.RESEND_FROM_EMAIL ||
      "Factory2Key <onboarding@resend.dev>";

    const e = {
      developer_name: escapeHtml(d.developer_name),
      email: escapeHtml(d.email),
      mobile: escapeHtml(d.mobile),
      website: escapeHtml(d.website),
      estate_name: escapeHtml(d.estate_name),
      estate_location: escapeHtml(d.estate_location),
      estate_postcode: escapeHtml(d.estate_postcode),
      zoning_status: escapeHtml(d.zoning_status),
      vision: escapeHtml(d.vision),
      deal_preferences: escapeHtml(d.deal_preferences),
      submitter_role: escapeHtml(d.submitter_role),
      site_control: escapeHtml(d.site_control),
      landowner_name: escapeHtml(d.landowner_details?.name ?? null),
      landowner_email: escapeHtml(d.landowner_details?.email ?? null),
      landowner_phone: escapeHtml(d.landowner_details?.phone ?? null),
      landowner_note: escapeHtml(d.landowner_details?.note ?? null),
    };

    const landownerBlock = [e.landowner_name, e.landowner_email, e.landowner_phone]
      .filter(Boolean)
      .join(" · ");

    const unitLabel = { ha: "ha", acres: "acres", m2: "m²" } as const;
    const siteSize =
      d.site_area_value != null
        ? `${d.site_area_value} ${unitLabel[d.site_area_unit ?? "ha"]}`
        : "";

    const row = (label: string, value: string) =>
      value
        ? `<tr><td style="padding:4px 12px;color:#666;vertical-align:top">${label}</td><td style="padding:4px 12px;color:#1A2744">${value}</td></tr>`
        : "";

    const uploadList = uploads.length
      ? uploads
          .map(
            (u) =>
              `<li><a href="${u.url}" style="color:#00B5AD">${escapeHtml(u.name)}</a> (${Math.round(u.size / 1024)} KB)${u.category === "land_title" ? ' <strong style="color:#1A2744">— land title</strong>' : ""}</li>`,
          )
          .join("")
      : "";

    const transcript = d.voice_transcript?.length
      ? d.voice_transcript
          .map(
            (m) =>
              `<p style="margin:4px 0"><strong style="color:${m.role === "assistant" ? "#00B5AD" : "#1A2744"}">${m.role === "assistant" ? "Morgan" : "Developer"}:</strong> ${escapeHtml(m.content)}</p>`,
          )
          .join("")
      : "";

    const adminHtml = `
      <div style="max-width:640px;font-family:sans-serif">
        <div style="background:#1A2744;padding:24px 32px">
          <h1 style="color:#fff;margin:0;font-size:22px">New Developer Onboarding</h1>
          <p style="color:#00B5AD;margin:4px 0 0;font-size:13px">${e.developer_name} — ${e.estate_name}</p>
        </div>
        <div style="padding:24px 32px;background:#fff">
          <table style="border-collapse:collapse;font-size:14px;width:100%">
            ${row("Enquiring as", e.submitter_role)}
            ${row("Contact", `<strong>${e.developer_name}</strong>`)}
            ${row("Email", `<a href="mailto:${encodeURIComponent(d.email)}" style="color:#1A2744">${e.email}</a>`)}
            ${row("Mobile", e.mobile)}
            ${row("Website", d.website ? `<a href="${escapeHtml(d.website)}" style="color:#00B5AD">${e.website}</a>` : "")}
            ${row("Estate / project", `<strong>${e.estate_name}</strong>`)}
            ${row("Location", `${e.estate_location}${d.estate_postcode ? ` ${e.estate_postcode}` : ""}`)}
            ${row("Lot &amp; plan", escapeHtml(d.lot_plan_reference))}
            ${row("Site size", escapeHtml(siteSize))}
            ${row("Homes / lots", escapeHtml(d.dwellings_envisaged))}
            ${row("Zoning / status", e.zoning_status)}
            ${row("Site control", e.site_control)}
            ${row("Land owner", landownerBlock)}
            ${row("Owner note", e.landowner_note)}
          </table>
          ${e.vision ? `<h3 style="color:#1A2744;font-size:14px;margin:20px 0 4px">Vision</h3><p style="font-size:14px;color:#4A5568;line-height:1.6;white-space:pre-wrap">${e.vision}</p>` : ""}
          ${e.deal_preferences ? `<h3 style="color:#1A2744;font-size:14px;margin:20px 0 4px">Deal preferences</h3><p style="font-size:14px;color:#4A5568;line-height:1.6;white-space:pre-wrap">${e.deal_preferences}</p>` : ""}
          ${uploadList ? `<h3 style="color:#1A2744;font-size:14px;margin:20px 0 4px">Uploads</h3><ul style="font-size:14px;color:#4A5568;line-height:1.7">${uploadList}</ul>` : ""}
          ${propertyCheckEmailBlock(propertyCheck, escapeHtml)}
          ${transcript ? `<h3 style="color:#1A2744;font-size:14px;margin:20px 0 4px">Voice discovery (Morgan)</h3><div style="font-size:13px;color:#4A5568;line-height:1.5;background:#F8FAFC;padding:12px 16px;border-radius:6px">${transcript}</div>` : ""}
        </div>
        <div style="background:#F5F3EE;padding:16px 32px;font-size:11px;color:#999">
          Submitted via the Factory2Key developer onboarding page. Create the estate page manually and follow up with the developer.
        </div>
      </div>`;

    const { error: adminErr } = await resend.emails.send({
      from,
      to: notifyTo,
      subject: `New developer onboarding — ${d.developer_name} (${d.estate_name})`,
      html: adminHtml,
    });
    if (adminErr) console.error("developer onboarding admin notification: Resend send error:", adminErr);

    // Confirmation to the developer.
    const { error: confirmErr } = await resend.emails.send({
      from,
      to: d.email,
      subject: "Factory2Key — thanks for telling us about your project",
      html: `
        <div style="max-width:600px;font-family:sans-serif">
          <div style="background:#1A2744;padding:24px 32px">
            <h1 style="color:#fff;margin:0;font-size:22px">Factory2Key</h1>
          </div>
          <div style="padding:32px;background:#fff">
            <p style="font-size:16px;color:#1A2744">Hi ${e.developer_name.split(" ")[0] || e.developer_name},</p>
            <p style="font-size:14px;color:#4A5568;line-height:1.6">
              Thank you for sharing your vision for <strong>${e.estate_name}</strong> with us. We've received your details${uploads.length ? ` and ${uploads.length} file${uploads.length > 1 ? "s" : ""}` : ""}, and a member of the Factory2Key team will be in touch shortly to talk through next steps.
            </p>
            <p style="font-size:14px;color:#4A5568;line-height:1.6">
              In the meantime, feel free to reply to this email with anything else you'd like us to know.
            </p>
            <p style="font-size:14px;color:#1A2744;margin-top:24px">
              Warm regards,<br><strong>The Factory2Key Team</strong>
            </p>
          </div>
          ${registrantAckFooterHtml(d.email)}
        </div>`,
    });
    if (confirmErr) console.error("developer onboarding confirmation: Resend send error:", confirmErr);
  } catch (err) {
    console.error("Failed to send developer onboarding emails:", err);
  }

  return NextResponse.json({ success: true });
}
