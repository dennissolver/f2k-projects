import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminUser, hasPermission } from "@/lib/admin-auth";
import { createSupabaseService } from "@/lib/supabase-service";
import { generateInvite } from "@/lib/agents/invite";
import { renderBrandedEmail } from "@/lib/seafields/notify";
import { escapeHtml } from "@/lib/html-escape";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://f2k-projects.vercel.app";
const ESTATES = ["seafields", "branscombe"] as const;

const AGENT_SELECT =
  "id, name, email, phone, agency, estate_access, active, status, invite_expires_at, created_at";

const createSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  email: z.string().email("A valid email is required"),
  phone: z.string().max(40).nullable().optional(),
  agency: z.string().max(120).nullable().optional(),
  // "project" in the UI — which estate(s) the agent can see.
  estate_access: z.array(z.enum(ESTATES)).min(1, "Pick at least one project"),
});

export async function GET() {
  const admin = await getAdminUser();
  if (!admin || !hasPermission(admin.role, "manage_agents")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const service = createSupabaseService();
  const { data, error } = await (service.from("agents") as any)
    .select(AGENT_SELECT)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("list agents error:", error);
    return NextResponse.json({ error: "Failed to load agents" }, { status: 500 });
  }
  return NextResponse.json({ agents: data ?? [] });
}

export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (!admin || !hasPermission(admin.role, "manage_agents")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }
  const d = parsed.data;
  const service = createSupabaseService();
  const invite = generateInvite();

  const { data: agent, error } = await (service.from("agents") as any)
    .insert({
      name: d.name.trim(),
      email: d.email.trim().toLowerCase(),
      phone: d.phone?.trim() || null,
      agency: d.agency?.trim() || null,
      estate_access: d.estate_access,
      status: "pending",
      active: true,
      invite_token_hash: invite.tokenHash,
      invite_code_hash: invite.codeHash,
      invite_expires_at: invite.expiresAt,
      invited_by: admin.id,
    })
    .select(AGENT_SELECT)
    .single();

  if (error) {
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.json(
        { error: "An agent with that email already exists." },
        { status: 409 },
      );
    }
    console.error("create agent insert error:", error);
    return NextResponse.json({ error: "Failed to create agent" }, { status: 500 });
  }

  const activateUrl = `${SITE_URL}/agent/activate?token=${encodeURIComponent(invite.token)}`;

  // Branded invite email — best-effort, never blocks the create response.
  let emailSent = false;
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    const html = renderBrandedEmail({
      preheader: "You've been invited to the Seafields agent portal",
      heading: "You've been invited to the Seafields agent portal",
      intro: `${escapeHtml(d.name)}, you've been set up as an agent for Seafields Estate. Click the button below to activate your account, then enter your access code when prompted.`,
      rows: [
        {
          label: "Your access code",
          value: `<strong style="font-size:18px;letter-spacing:3px">${escapeHtml(invite.code)}</strong>`,
        },
        { label: "Agency", value: escapeHtml(d.agency || "—") },
      ],
      ctaLabel: "Activate my account",
      ctaHref: activateUrl,
      footer:
        "This invite expires in 14 days. The access code is required in addition to this link. If you weren't expecting this, you can ignore this email.",
    });
    await resend.emails.send({
      from:
        process.env.RESEND_FROM_EMAIL ||
        "Seafields Estate <noreply@updates.corporateaisolutions.com>",
      to: [d.email.trim()],
      subject: "Your Seafields agent portal invite",
      html,
    });
    emailSent = true;
  } catch (err) {
    console.error("agent invite email failed:", err);
  }

  await service.from("audit_log").insert({
    actor_id: null,
    actor_email: admin.email,
    action: "agent_created",
    entity_type: "agent",
    entity_id: agent.id,
    details: {
      name: d.name,
      email: d.email,
      agency: d.agency,
      estate_access: d.estate_access,
      email_sent: emailSent,
    },
  });

  // Return link + code so the admin can also forward the invite personally.
  return NextResponse.json({ agent, inviteLink: activateUrl, code: invite.code, emailSent });
}
