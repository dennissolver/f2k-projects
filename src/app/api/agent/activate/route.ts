import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseService } from "@/lib/supabase-service";
import { hashToken, verifyCode, inviteExpired } from "@/lib/agents/invite";

const schema = z.object({
  token: z.string().min(10),
  code: z.string().min(4),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { token, code, password } = parsed.data;
  const service = createSupabaseService();

  // Look the pending agent up by the link token's HMAC (never the raw token).
  const { data: agent } = await (service.from("agents") as any)
    .select("id, email, status, active, invite_code_hash, invite_expires_at, auth_user_id")
    .eq("invite_token_hash", hashToken(token))
    .maybeSingle();

  // Uniform failure — don't reveal which factor (token vs code vs expiry) failed.
  const fail = () =>
    NextResponse.json(
      { error: "Invalid or expired invite. Check your link and code, or ask for a new invite." },
      { status: 400 },
    );

  if (!agent || !agent.active) return fail();
  if (agent.status === "active" || agent.auth_user_id) {
    return NextResponse.json(
      { error: "This invite has already been used. Please sign in." },
      { status: 409 },
    );
  }
  if (!agent.invite_code_hash || !verifyCode(code, agent.invite_code_hash)) return fail();
  if (inviteExpired(agent.invite_expires_at)) return fail();

  // Create the auth user (email pre-confirmed — Uwe vouched via the invite).
  const { data: created, error: cErr } = await service.auth.admin.createUser({
    email: agent.email,
    password,
    email_confirm: true,
  });
  if (cErr || !created?.user) {
    console.error("agent activate createUser error:", cErr);
    return NextResponse.json(
      { error: "Could not activate — this email may already have an account. Try signing in." },
      { status: 400 },
    );
  }

  // Link the agents row, mark active, consume the invite.
  const { error: uErr } = await (service.from("agents") as any)
    .update({
      auth_user_id: created.user.id,
      status: "active",
      invite_token_hash: null,
      invite_code_hash: null,
      invite_expires_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", agent.id);
  if (uErr) {
    console.error("agent activate link error:", uErr);
    return NextResponse.json({ error: "Activation failed. Please try again." }, { status: 500 });
  }

  await service.from("audit_log").insert({
    actor_email: agent.email,
    action: "agent_activated",
    entity_type: "agent",
    entity_id: agent.id,
    details: {},
  });

  // Client signs in with this email + the password just set.
  return NextResponse.json({ ok: true, email: agent.email });
}
