import { NextResponse } from "next/server";
import { createSupabaseService } from "@/lib/supabase-service";

export const dynamic = "force-dynamic";

/**
 * Public lot register for Wavecrest Estate (lots 83–115).
 *
 * Reads wavecrest_lot_allocations (migration 0060). Returns only the
 * public-safe columns — pricing is suppressed for sold / under-contract lots
 * (we never advertise a price on a lot that isn't for sale), and the synthetic
 * address (no titles issued yet) is surfaced as-is.
 *
 * Area handling honours the per-row confidence: surveyed | plan_ocr |
 * narrative | illegible. Illegible lots carry sqm=null → the UI shows
 * "area TBC" rather than a fabricated figure.
 */
export async function GET() {
  const supabase = createSupabaseService();

  try {
    const { data, error } = await (supabase
      .from("wavecrest_lot_allocations") as any)
      .select(
        "lot_number, sqm, area_confidence, status, zone, public_label, dwelling_type, retail_price, address, x_pct, y_pct"
      )
      .order("lot_number", { ascending: true });

    if (error) {
      return NextResponse.json({ lots: [] });
    }

    type Row = {
      lot_number: number;
      sqm: number | null;
      area_confidence: string | null;
      status: string;
      zone: string | null;
      public_label: string | null;
      dwelling_type: string | null;
      retail_price: number | null;
      address: string | null;
      x_pct: number | null;
      y_pct: number | null;
    };

    const lots = ((data || []) as Row[]).map((r) => {
      // Suppress price on anything not openly for sale.
      const priceVisible = r.status === "available" || r.status === "under_contract";
      return {
        lotNumber: r.lot_number,
        label: r.public_label || `Lot ${r.lot_number}`,
        sqm: r.sqm,
        areaConfidence: r.area_confidence,
        status: r.status,
        zone: r.zone,
        dwellingType: r.dwelling_type,
        retailPrice: priceVisible ? r.retail_price : null,
        address: r.address,
        xPct: r.x_pct,
        yPct: r.y_pct,
      };
    });

    return NextResponse.json({ lots });
  } catch {
    return NextResponse.json({ lots: [] });
  }
}
