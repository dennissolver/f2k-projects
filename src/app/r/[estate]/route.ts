import { NextRequest, NextResponse } from "next/server";
import { createSupabaseService } from "@/lib/supabase-service";
import { estateRegisterPath } from "@/lib/agents/attribution-token";
import {
  firstTouchCookieName,
  signFirstTouch,
  parseFirstTouch,
  FIRST_TOUCH_MAX_AGE_SECONDS,
} from "@/lib/attribution/first-touch";

/**
 * Agent attribution resolver (ROI portal, spec §2/§4).
 *
 *   /r/<estate>?ref=TOKEN
 *
 * Looks up the agent behind TOKEN, stamps a signed first-touch cookie (the evidence of who
 * introduced this buyer), and lands them on the estate's waitlist page. The waitlist form reads
 * the cookie (server-side) and writes the attribution onto the registration row.
 *
 * Rules enforced here:
 *  - First-touch wins: a valid existing cookie for this estate is never overwritten.
 *  - No self-claim / graceful fallback: an unknown/inactive token, or an agent without access
 *    to this estate, sets NO attribution — the buyer simply lands in the unassigned pool.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { estate: string } },
) {
  const estate = (params.estate || "").toLowerCase();
  const { searchParams } = new URL(request.url);
  const ref = searchParams.get("ref")?.trim() || "";

  // Guard the estate slug (defends the redirect target shape).
  if (!/^[a-z][a-z0-9-]*$/.test(estate)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const service = createSupabaseService();

  // Estate must exist (config-driven; spec §5/§8).
  const { data: estateRow } = await (service.from("estates") as any)
    .select("slug")
    .eq("slug", estate)
    .maybeSingle();
  if (!estateRow) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const dest = new URL(estateRegisterPath(estate), request.url);
  const response = NextResponse.redirect(dest);

  if (!ref) {
    return response; // direct/generic arrival → unassigned pool
  }

  // First-touch wins: don't disturb an existing valid attribution for this estate.
  const cookieName = firstTouchCookieName(estate);
  const existing = parseFirstTouch(request.cookies.get(cookieName)?.value);
  if (existing) {
    return response;
  }

  // Resolve the agent behind the token.
  const { data: agent } = await (service.from("agents") as any)
    .select("id, active, estate_access, agency_id")
    .eq("attribution_token", ref)
    .maybeSingle();

  const hasAccess =
    agent &&
    agent.active &&
    Array.isArray(agent.estate_access) &&
    agent.estate_access.includes(estate);

  if (!hasAccess) {
    return response; // invalid/inactive/no-access → unassigned pool, no attribution
  }

  const value = signFirstTouch({
    estate,
    agentId: agent.id,
    agencyId: agent.agency_id ?? null,
    token: ref,
    firstTouchAt: new Date().toISOString(),
  });

  response.cookies.set({
    name: cookieName,
    value,
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: FIRST_TOUCH_MAX_AGE_SECONDS,
  });

  return response;
}
