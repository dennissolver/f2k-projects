import { NextResponse } from "next/server";
import { getAdminUser, hasPermission } from "@/lib/admin-auth";
import { createSupabaseService } from "@/lib/supabase-service";
import {
  generateAttributionToken,
  buildAgentLink,
} from "@/lib/agents/attribution-token";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://f2k-projects.vercel.app";

const ESTATE_LABELS: Record<string, string> = {
  seafields: "Seafields",
  branscombe: "Branscombe",
};

// POST — return the agent's tokenised attribution links, one per estate they cover.
// Idempotent: mints the attribution_token only if the agent doesn't already have one,
// so the share link is stable across repeated opens (re-minting would break links the
// agent has already distributed).
export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const admin = await getAdminUser();
  if (!admin || !hasPermission(admin.role, "manage_agents")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const service = createSupabaseService();
  const { data: agent, error } = await (service.from("agents") as any)
    .select("id, name, estate_access, attribution_token")
    .eq("id", params.id)
    .maybeSingle();

  if (error || !agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  let token: string = agent.attribution_token;
  if (!token) {
    token = generateAttributionToken();
    const { error: updErr } = await (service.from("agents") as any)
      .update({ attribution_token: token, updated_at: new Date().toISOString() })
      .eq("id", params.id);
    if (updErr) {
      console.error("mint attribution_token error:", updErr);
      return NextResponse.json(
        { error: "Failed to generate link" },
        { status: 500 },
      );
    }
    await service.from("audit_log").insert({
      actor_email: admin.email,
      action: "agent_attribution_token_minted",
      entity_type: "agent",
      entity_id: params.id,
      details: { name: agent.name },
    });
  }

  const estates: string[] = agent.estate_access ?? [];
  const links = estates.map((estate) => ({
    estate,
    label: ESTATE_LABELS[estate] ?? estate,
    url: buildAgentLink(SITE_URL, estate, token),
  }));

  return NextResponse.json({ token, links });
}
