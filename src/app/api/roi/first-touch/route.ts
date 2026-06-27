import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseService } from "@/lib/supabase-service";
import { firstTouchCookieName, parseFirstTouch } from "@/lib/attribution/first-touch";

/**
 * ROI portal — surfaces the current first-touch attribution for an estate to the
 * waitlist form, so a buyer arriving via an agent link sees "registering via [agent]".
 *
 * The first-touch cookie is HttpOnly (not readable by page JS), so the agent's identity
 * is resolved here, server-side, from the signed cookie — never exposed as a raw value.
 * Returns { attributed: false } for direct/unattributed arrivals.
 *
 *   GET /api/roi/first-touch?estate=branscombe
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const estate = (searchParams.get("estate") || "").toLowerCase();
  if (!/^[a-z][a-z0-9-]*$/.test(estate)) {
    return NextResponse.json({ attributed: false });
  }

  const ft = parseFirstTouch(cookies().get(firstTouchCookieName(estate))?.value);
  if (!ft || ft.estate !== estate) {
    return NextResponse.json({ attributed: false });
  }

  const supabase = createSupabaseService();
  const { data: agent } = await (supabase.from("agents") as any)
    .select("id, name, agency, active")
    .eq("id", ft.agentId)
    .maybeSingle();

  if (!agent || !agent.active) {
    return NextResponse.json({ attributed: false });
  }

  return NextResponse.json({
    attributed: true,
    agentName: agent.name as string,
    agencyName: (agent.agency as string | null) ?? null,
  });
}
