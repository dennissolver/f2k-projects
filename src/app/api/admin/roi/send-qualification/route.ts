import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminUser, hasPermission } from "@/lib/admin-auth";
import { createSupabaseService } from "@/lib/supabase-service";
import { isSuppressed } from "@/lib/email/unsubscribe";
import { buildQualifyUrl } from "@/lib/roi/qualify-link";
import { buildCoveringEmail } from "@/lib/roi/covering-email";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://f2k-projects.vercel.app";

const schema = z.object({ waitlist_id: z.string().uuid() });

// POST — F2K admin sends the agent-branded covering email containing the pre-attributed,
// pre-filled qualification-form link to a waitlist buyer (spec §3 step 6).
export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (!admin || !hasPermission(admin.role, "manage_agents")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "A waitlist id is required" }, { status: 400 });
  }

  const supabase = createSupabaseService();
  const { data: waitlist } = await (supabase.from("waitlist_registrations") as any)
    .select("id, estate_id, name, email, introducing_agent_id, status")
    .eq("id", parsed.data.waitlist_id)
    .maybeSingle();
  if (!waitlist) {
    return NextResponse.json({ error: "Waitlist registration not found" }, { status: 404 });
  }

  // Respect unsubscribe (Spam Act) — never send to a suppressed address.
  if (await isSuppressed(waitlist.email)) {
    return NextResponse.json(
      { error: "This buyer has unsubscribed and can't be emailed." },
      { status: 400 },
    );
  }

  const { data: estate } = await (supabase.from("estates") as any)
    .select("slug, name")
    .eq("id", waitlist.estate_id)
    .maybeSingle();
  if (!estate) {
    return NextResponse.json({ error: "Estate not found" }, { status: 404 });
  }

  let agentName: string | null = null;
  let agentPhone: string | null = null;
  if (waitlist.introducing_agent_id) {
    const { data: agent } = await (supabase.from("agents") as any)
      .select("name, phone")
      .eq("id", waitlist.introducing_agent_id)
      .maybeSingle();
    agentName = agent?.name ?? null;
    agentPhone = agent?.phone ?? null;
  }

  const qualifyUrl = buildQualifyUrl(SITE_URL, estate.slug, waitlist.id);
  const { subject, html } = buildCoveringEmail({
    buyerName: waitlist.name,
    buyerEmail: waitlist.email,
    estateName: estate.name,
    qualifyUrl,
    agentName,
    agentPhone,
  });

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      to: waitlist.email,
      from:
        process.env.RESEND_FROM_EMAIL ||
        "Branscombe Estate <noreply@updates.corporateaisolutions.com>",
      subject,
      html,
    });
  } catch (err) {
    console.error("send-qualification email failed:", err);
    return NextResponse.json({ error: "Failed to send the email" }, { status: 500 });
  }

  // Mark contacted + nudged so the 48h auto-nudge doesn't also fire.
  await (supabase.from("waitlist_registrations") as any)
    .update({
      nudged_at: new Date().toISOString(),
      status: waitlist.status === "new" ? "contacted" : waitlist.status,
    })
    .eq("id", waitlist.id);

  await supabase.from("audit_log").insert({
    actor_email: admin.email,
    action: "roi_qualification_link_sent",
    entity_type: "waitlist_registration",
    entity_id: waitlist.id,
    details: { estate: estate.slug, email: waitlist.email },
  });

  return NextResponse.json({ success: true });
}
