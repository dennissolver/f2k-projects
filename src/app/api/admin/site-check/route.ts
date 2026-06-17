import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin-auth";
import { runPropertyCheck } from "@/lib/property-check";

// Admin-gated, reusable estate "site check": runs @caistech/property-services derive for an
// estate address and returns the first-pass site analysis (LGA, zoning, wind/BAL/climate, overlays,
// indicative max-lots). Runs server-side in production where PROPERTY_SERVICES_URL/_API_KEY live
// (both sensitive, prod-only — never NEXT_PUBLIC), so the key is never exposed to the client.
//
// This is the "address → show the analysis" substrate behind the estate-page pipeline: feed any
// estate address, get the machine-verified planning/environment layer to surface on its page.
export const dynamic = "force-dynamic";

interface SiteCheckBody {
  suburb?: string;
  postcode?: string;
  state?: string;
  lat?: number | string | null;
  lng?: number | string | null;
  lotPlanReference?: string;
}

function num(v: number | string | null | undefined): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function POST(request: Request) {
  // Any authenticated admin may run a read-only site check (no destructive action, no PII written).
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: SiteCheckBody;
  try {
    body = (await request.json()) as SiteCheckBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const suburb = body.suburb?.trim();
  if (!suburb) {
    return NextResponse.json({ error: "A suburb/locality is required" }, { status: 400 });
  }

  const result = await runPropertyCheck(
    {
      estate_location: suburb,
      estate_postcode: body.postcode?.trim() || null,
      estate_state: body.state?.trim() || null,
      estate_lat: num(body.lat),
      estate_lng: num(body.lng),
      lot_plan_reference: body.lotPlanReference?.trim() || null,
    },
    25_000,
  );

  return NextResponse.json({ result });
}
