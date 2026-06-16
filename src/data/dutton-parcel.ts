// dutton-parcel.ts — the Dutton Terrace parcel outline drawn on the satellite map.
//
// ⚠ INDICATIVE, NOT SURVEYED. The exact boundary of Allotment 50, Deposited Plan 90582 lives in
// South Australia's cadastre, which is token-gated ("not open data" — it must be requested from
// Land Services SA; the public SAPPA viewer reaches it only via a server-side token). Until the
// real DP geometry is in hand, this is an AREA-ACCURATE (~6.31 ha) schematic rectangle centred on
// the geocoded site, drawn DASHED + labelled "indicative" so it never reads as a surveyed line.
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

// Box maths: a 6.306 ha square is 251.1 m per side (half-side 125.56 m). Converted to degrees at
// the site latitude (−34.38°): ±0.001366° lng, ±0.001128° lat about the centre. Rounded to 6 dp
// (~0.1 m), which is far finer than the "indicative" claim needs.
export const DUTTON_PARCEL: ParcelOutline = {
  indicative: true,
  areaHa: 6.31,
  center: { lat: -34.380017, lng: 136.095408 },
  ring: [
    [136.094042, -34.381145], // SW
    [136.096774, -34.381145], // SE
    [136.096774, -34.378889], // NE
    [136.094042, -34.378889], // NW
    [136.094042, -34.381145], // close
  ],
};
