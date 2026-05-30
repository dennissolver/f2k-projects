import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin-auth";
import { createSupabaseService } from "@/lib/supabase-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { agentIds, subject, message } = body;

  if (!agentIds || !Array.isArray(agentIds) || agentIds.length === 0) {
    return NextResponse.json({ error: "No agents selected" }, { status: 400 });
  }
  if (!subject?.trim()) {
    return NextResponse.json({ error: "Subject required" }, { status: 400 });
  }
  if (!message?.trim()) {
    return NextResponse.json({ error: "Message required" }, { status: 400 });
  }

  const service = createSupabaseService();

  const { data: agents } = await service
    .from("agents")
    .select("id, name, email")
    .in("id", agentIds)
    .eq("active", true);

  if (!agents || agents.length === 0) {
    return NextResponse.json({ error: "No active agents found" }, { status: 404 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 500 });
  }

  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);

  const results: { email: string; status: string; error?: string }[] = [];

  for (const agent of agents) {
    try {
      const html = `
        <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1a1a;">${subject}</h2>
          <div style="color: #444; line-height: 1.6; white-space: pre-wrap;">${message}</div>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
          <p style="color: #888; font-size: 12px;">
            This is an official message from Factory2Key Projects administration.
          </p>
        </div>
      `;

      const sendResult = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || "Seafields Estate <noreply@updates.corporateaisolutions.com>",
        to: agent.email,
        subject,
        html,
      });

      const providerMessageId = sendResult.data?.id || null;
      const error = sendResult.error?.message || null;

      await service.from("messages").insert({
        direction: "outbound",
        channel: "email",
        sender_id: null,
        sender_email: admin.email,
        recipient_id: agent.id,
        recipient_email: agent.email,
        subject,
        body: message,
        status: error ? "failed" : "sent",
        error: error || null,
        provider_message_id: providerMessageId,
      });

      results.push({
        email: agent.email,
        status: error ? "failed" : "sent",
        error,
      });
    } catch (err) {
      results.push({
        email: agent.email,
        status: "failed",
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  const sent = results.filter((r) => r.status === "sent").length;
  const failed = results.filter((r) => r.status === "failed").length;

  return NextResponse.json({
    summary: { total: agents.length, sent, failed },
    results,
  });
}
