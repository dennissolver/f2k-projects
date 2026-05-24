import { NextResponse } from "next/server";
import { getAgentUser } from "@/lib/agents/agent-auth";
import { createSupabaseService } from "@/lib/supabase-service";

// Masked lot availability for agents. Reads ONLY the identity-free
// seafields_public_lots view and selects a public-safe column set — status,
// size, stage, public price. Deliberately excludes allocated_to /
// allocation_bucket / wholesale / notes so an agent sees that a lot is taken,
// never WHO holds it.
export async function GET() {
  const agent = await getAgentUser();
  if (!agent) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const service = createSupabaseService();
  const { data, error } = await (service.from("seafields_public_lots") as any)
    .select(
      "lot_number, sqm, category, zone, status, stage_number, stage_label, is_open_for_registration, total_price",
    )
    .order("lot_number", { ascending: true });
  if (error) {
    console.error("agent availability error:", error);
    return NextResponse.json({ error: "Failed to load availability" }, { status: 500 });
  }
  return NextResponse.json({ lots: data ?? [] });
}
