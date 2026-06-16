// static-map-overlay.ts — project lng/lat onto a Mapbox Static Images frame (logical pixels).
//
// Lets us draw a vector overlay (e.g. a parcel outline) on top of a getStaticMapUrl() image
// WITHOUT forking @caistech/mapbox: the static image is centred on (centerLng, centerLat) at
// `zoom`, and this reproduces Mapbox's Web Mercator projection (512 px tiles) so an absolutely-
// positioned SVG with a viewBox of width×height lines up with the raster. Mapbox renders @2x for
// retina, but the logical coordinate space is unchanged, so everything here is in logical (CSS) px.
//
// (Generic enough to be a future @caistech/mapbox addition — if a SECOND estate needs a static-map
// overlay, promote it there per the shared-service extraction rule. One use = local is fine.)

const TILE = 512;

function worldSize(zoom: number): number {
  return TILE * Math.pow(2, zoom);
}

function lngToWorldX(lng: number, ws: number): number {
  return ((lng + 180) / 360) * ws;
}

function latToWorldY(lat: number, ws: number): number {
  const s = Math.sin((lat * Math.PI) / 180);
  // Standard Web Mercator normalised Y, scaled to world size. Clamped to avoid Infinity at poles.
  const y = 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
  return y * ws;
}

export interface StaticFrame {
  centerLng: number;
  centerLat: number;
  zoom: number;
  width: number;
  height: number;
}

/** lng/lat → [x, y] in logical pixels within a width×height static map centred on the frame. */
export function projectToStaticPixel(lng: number, lat: number, f: StaticFrame): [number, number] {
  const ws = worldSize(f.zoom);
  const dx = lngToWorldX(lng, ws) - lngToWorldX(f.centerLng, ws);
  const dy = latToWorldY(lat, ws) - latToWorldY(f.centerLat, ws);
  return [f.width / 2 + dx, f.height / 2 + dy];
}

/** Project a closed ring of [lng, lat] pairs to an SVG `points` string in logical pixels. */
export function ringToSvgPoints(ring: [number, number][], f: StaticFrame): string {
  return ring
    .map(([lng, lat]) => {
      const [x, y] = projectToStaticPixel(lng, lat, f);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}
