// dutton-parcel.ts — the Dutton Terrace parcel outline drawn on the satellite map.
//
// ⚠ INDICATIVE, NOT SURVEYED. The exact boundary of Allotment 50, Deposited Plan 90582 lives in
// South Australia's cadastre, which is token-gated ("not open data" — it must be requested from
// Land Services SA; the public SAPPA viewer reaches it only via a server-side token). Until the
// real DP geometry is in hand, this is an AREA-ACCURATE (~6.31 ha) schematic centred on the
// geocoded site, drawn DASHED + labelled "indicative" so it never reads as a surveyed line.
//
// SHAPE (traced 2026-06-17 from Harris RE / Rachel Hawkins' supplied aerial): the real allotment is
// a wide block ~381 m × ~166 m (≈6.3 ha) that is NOT axis-aligned — it is rotated ~3.5° (the long
// axis dips south going east, matching the Dutton Tce / Church St street grid) and its NE corner is
// CLIPPED (the top edge runs ~92% east, then a small notch down to the east edge near Trezise St).
// Her dashed outline was colour-extracted (docs/Dutton_terrace tooling), reduced to corners, mapped
// onto the verified ground envelope, and the result re-rendered over the satellite tile to confirm
// it tracks Dutton Tce (S), Church St (N), Thuruna Rd (W) and Trezise St (E) — i.e. her exact block.
// Still INDICATIVE (her source is an aerial trace, not the surveyed DP) → stays dashed + labelled.
//
// TO REPLACE WITH THE REAL BOUNDARY (a one-file change): flip `indicative` to false and replace
// `ring` with the DP 90582 polygon (closed ring of [lng, lat] pairs). The map framing + rendering
// pick it up automatically. Source it from the DP or a georeferenced site plan (developer / LSSA).

export interface ParcelOutline {
  /** True while this is the schematic area box, not the surveyed DP boundary. Drives the dashed
   *  styling + the "indicative" caption — keep it true until a real DP polygon replaces `ring`. */
  indicative: boolean;
  /** Parcel area in hectares (per the proposal: Allotment 50 DP 90582 ≈ 6.306 ha). */
  areaHa: number;
  /** Geocoded site centre — also the static map's centre, so the box sits mid-frame. */
  center: { lat: number; lng: number };
  /** Closed ring of [lng, lat] pairs (last == first). */
  ring: [number, number][];
}

// Geometry: built in a frame about (136.095408, −34.379268). The raw "Dutton Terrace" geocode landed
// ON the street (−34.380017 = the south frontage), so the frame sits ~83 m north of it. Local scale
// 1° lng ≈ 91,895 m, 1° lat ≈ 110,574 m. Long axis rotated 3.5° (dips south going east, matching the
// street grid); short half 82.8 m. The EAST edge is extended to the road (≈285 m east of centre, vs
// 190 m west) so the outline runs the FULL width of the cleared block to Trezise St — matching
// Rachel's supplied outline (her east boundary reaches the road). 6 points: SW → SE → E(small clip)
// → NE-top → NW → close. Re-rendered over the satellite tile to confirm (S on Dutton Tce, N below
// Church St, W ~Thuruna Rd, E at the Trezise St road).
//
// NOTE on area (Dennis, 2026-06-17): the drawn outline ≈7.9 ha vs the 6.306 ha title figure is NOT
// worth chasing — F2K sells LOTS (house-and-land), not the parcel en bloc, so the total site area is
// orientation context, not the product. This outline is an INDICATIVE site boundary only; the real
// product detail is the LOT LAYOUT (count + indicative lot boundaries), which can only come from the
// submitter's master plan (requested from Zen/Rachel 2026-06-17). Don't reconcile the two areas.
export const DUTTON_PARCEL: ParcelOutline = {
  indicative: true,
  areaHa: 6.31, // title-area figure (Allotment 50, DP 90582). NB: the drawn outline ≈7.9 ha — see note.
  center: { lat: -34.379268, lng: 136.095408 },
  ring: [
    [136.093285, -34.379910], // SW (on Dutton Tce, west)
    [136.098449, -34.380173], // SE (on Dutton Tce, east — at the road)
    [136.098528, -34.379089], // E  (east edge by Trezise St — small clip)
    [136.098342, -34.378667], // NE-top (top edge, ~93% east before the notch)
    [136.093395, -34.378415], // NW (below Church St)
    [136.093285, -34.379910], // close
  ],
};
