/**
 * Export the Seafields coloured "stages" block map as print-grade artwork.
 *
 * Produces, into exports/seafields-block-map/ :
 *   - seafields-block-map.svg            faithful (map + STAGES legend, navy)
 *   - seafields-block-map.png            faithful, ~6400px wide (>5MB)
 *   - seafields-block-map-labelled.svg   + on-map Stage labels & street names
 *   - seafields-block-map-labelled.png   labelled, ~6400px wide
 *
 * Vector SVG is the master a signwriter should use (prints at any size with
 * zero pixelation); the PNGs satisfy the literal "high-res raster" request.
 *
 * Run:  node scripts/export-seafields-signboard.mjs
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { LOTS, STAGE_INFO, STAGE_ANCHORS } from "../src/data/seafields/lots.ts";
import POLY from "../src/data/seafields/polygons.json" with { type: "json" };

const require = createRequire(import.meta.url);
const { Resvg } = require("C:/Users/denni/AppData/Local/Temp/sf-rasterize/node_modules/@resvg/resvg-js");

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "exports", "seafields-block-map");
mkdirSync(OUT_DIR, { recursive: true });

const NAVY = "#1A2744";
const VW = POLY.viewWidth;   // 1000
const VH = POLY.viewHeight;  // 675.87

const lotById = new Map(LOTS.map((l) => [l.id, l]));
const STAGES = ["1", "2", "3", "4", "5", "6", "7"];

const d = (pts) =>
  pts.length === 0
    ? ""
    : pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ") + " Z";
const centroid = (pts) => ({
  x: pts.reduce((s, p) => s + p[0], 0) / pts.length,
  y: pts.reduce((s, p) => s + p[1], 0) / pts.length,
});
const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Build the inner map group (everything inside the survey viewBox). */
function mapGroup({ labelled }) {
  let s = "";

  // Subject-area paper
  if (POLY.subjectArea) {
    s += `<path d="${d(POLY.subjectArea)}" fill="#FAF8F4" stroke="#FFFFFF" stroke-width="1.5" opacity="0.97"/>`;
  }
  // Public Open Space
  if (POLY.pos) {
    s += `<path d="${d(POLY.pos)}" fill="#B8D99B" stroke="#6B9B4A" stroke-width="0.7"/>`;
    if (labelled) {
      const c = centroid(POLY.pos);
      s += `<text x="${c.x}" y="${c.y}" text-anchor="middle" dominant-baseline="middle" font-size="9" font-weight="600" fill="#3C5C2A" font-family="Arial, sans-serif">Public Open Space</text>`;
    }
  }
  // Road reserves (faint)
  s += `<g stroke="#E5E1D8" stroke-width="0.5">`;
  for (const seg of POLY.roadReserves || [])
    s += `<line x1="${seg[0][0]}" y1="${seg[0][1]}" x2="${seg[1][0]}" y2="${seg[1][1]}"/>`;
  s += `</g>`;
  // Road carriageways — slightly heavier than the web hero for print legibility
  s += `<g stroke="#A9A192" stroke-width="0.8" stroke-linecap="round">`;
  for (const seg of POLY.roads || [])
    s += `<line x1="${seg[0][0]}" y1="${seg[0][1]}" x2="${seg[1][0]}" y2="${seg[1][1]}"/>`;
  s += `</g>`;

  // Lot polygons coloured by stage (heavier borders than web for print)
  for (const [id, pts] of Object.entries(POLY.lots)) {
    const lot = lotById.get(id);
    if (!lot || !lot.stage) continue;
    const info = STAGE_INFO[lot.stage];
    s += `<path d="${d(POLY.amendments[id] || pts)}" fill="${info.color}" stroke="${info.border}" stroke-width="0.5" opacity="0.95"/>`;
  }

  // Lot numbers at each lot's centroid (white halo for legibility on colour)
  for (const [id, pts] of Object.entries(POLY.lots)) {
    const lot = lotById.get(id);
    if (!lot || !lot.stage) continue;
    const c = centroid(POLY.amendments[id] || pts);
    s += `<text x="${c.x}" y="${c.y}" text-anchor="middle" dominant-baseline="middle" font-size="5" font-weight="700" fill="#1A2744" font-family="Arial, sans-serif" style="paint-order:stroke;stroke:#FFFFFF;stroke-width:1px;stroke-linejoin:round">${lot.lotNumber}</text>`;
  }

  // Heritage lots (hatched) + their lot numbers
  for (const [id, pts] of Object.entries(POLY.heritageLots || {})) {
    s += `<path d="${d(pts)}" fill="url(#heritageHatch)" stroke="#8B6F1E" stroke-width="0.7" stroke-dasharray="2 1.5"/>`;
    const lot = lotById.get(id);
    if (lot) {
      const c = centroid(pts);
      s += `<text x="${c.x}" y="${c.y}" text-anchor="middle" dominant-baseline="middle" font-size="5" font-weight="700" fill="#5E4A0E" font-family="Arial, sans-serif" style="paint-order:stroke;stroke:#FFFFFF;stroke-width:1px;stroke-linejoin:round">${lot.lotNumber}</text>`;
    }
  }

  if (labelled) {
    // Stage labels at the data-defined anchors (anchors are % of the viewBox)
    for (const st of STAGES) {
      const a = STAGE_ANCHORS[st];
      if (!a) continue;
      const x = (a.x / 100) * VW;
      const y = (a.y / 100) * VH;
      const info = STAGE_INFO[st];
      const label = `STAGE ${st}`;
      const w = label.length * 6.2 + 10;
      s += `<g>
        <rect x="${x - w / 2}" y="${y - 9}" width="${w}" height="18" rx="3" fill="#FFFFFF" stroke="${info.border}" stroke-width="1.2" opacity="0.92"/>
        <text x="${x}" y="${y + 1}" text-anchor="middle" dominant-baseline="middle" font-size="10" font-weight="800" letter-spacing="0.5" fill="${info.border}" font-family="Arial, sans-serif">${label}</text>
      </g>`;
    }
    // Street names from the survey
    for (const sl of POLY.streetLabels || []) {
      const rot = sl.rotation ? ` transform="rotate(${-sl.rotation} ${sl.x} ${sl.y})"` : "";
      s += `<text x="${sl.x}" y="${sl.y}" text-anchor="middle" dominant-baseline="middle" font-size="6.5" font-weight="700" letter-spacing="1" fill="#1A2744" font-family="Arial, sans-serif"${rot} style="paint-order:stroke;stroke:#FFFFFF;stroke-width:1.4px;stroke-linejoin:round">${esc(sl.text)}</text>`;
    }
  }

  return s;
}

/** Compose a full poster SVG (navy bg + title + map + STAGES legend). */
function posterSVG({ labelled }) {
  const PAD = 36;
  const TITLE_H = 84;
  const LEGEND_H = 64;
  const GAP = 18;
  const W = VW + PAD * 2;
  const H = TITLE_H + VH + GAP + LEGEND_H + PAD;

  // STAGES legend chips, centred in a row
  const chipH = 26;
  const chips = STAGES.map((st) => ({
    st,
    label: `Stage ${st}`,
    ...STAGE_INFO[st],
  }));
  const chipGap = 10;
  const chipW = 96;
  const labelW = 80; // "STAGES:" label
  const rowW = labelW + chips.length * chipW + (chips.length - 1) * chipGap;
  let lx = (W - rowW) / 2;
  const ly = TITLE_H + VH + GAP;
  let legend = `<text x="${lx}" y="${ly + chipH / 2}" dominant-baseline="middle" font-size="14" font-weight="700" letter-spacing="3" fill="#FFFFFF" font-family="Arial, sans-serif">STAGES</text>`;
  lx += labelW;
  for (const c of chips) {
    legend += `<g>
      <rect x="${lx}" y="${ly}" width="${chipW}" height="${chipH}" rx="3" fill="${c.color}" stroke="${c.border}" stroke-width="1.5"/>
      <text x="${lx + chipW / 2}" y="${ly + chipH / 2 + 1}" text-anchor="middle" dominant-baseline="middle" font-size="13" font-weight="700" fill="#1A2744" font-family="Arial, sans-serif">${c.label}</text>
    </g>`;
    lx += chipW + chipGap;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1A2744"/>
      <stop offset="70%" stop-color="#1A2744"/>
      <stop offset="100%" stop-color="#16323F"/>
    </linearGradient>
    <pattern id="heritageHatch" patternUnits="userSpaceOnUse" width="5" height="5" patternTransform="rotate(45)">
      <rect width="5" height="5" fill="#F5E7D6"/>
      <line x1="0" y1="0" x2="0" y2="5" stroke="#C7A877" stroke-width="1.2"/>
    </pattern>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <text x="${W / 2}" y="40" text-anchor="middle" font-size="34" font-weight="800" fill="#FFFFFF" font-family="Georgia, 'Times New Roman', serif">Seafields Estate</text>
  <text x="${W / 2}" y="66" text-anchor="middle" font-size="14" letter-spacing="2" fill="#00B5AD" font-family="Arial, sans-serif">STAGED SUBDIVISION PLAN · 145 LOTS · WAGGRAKINE, GERALDTON WA</text>
  <g transform="translate(${PAD}, ${TITLE_H})">
    ${mapGroup({ labelled })}
  </g>
  ${legend}
</svg>`;
}

function rasterize(svg, outPng, targetWidth) {
  const r = new Resvg(svg, {
    fitTo: { mode: "width", value: targetWidth },
    background: NAVY,
    font: { loadSystemFonts: true },
  });
  const png = r.render().asPng();
  writeFileSync(outPng, png);
  return png.length;
}

for (const variant of [
  { labelled: false, base: "seafields-block-map" },
  { labelled: true, base: "seafields-block-map-labelled" },
]) {
  const WIDTH = Number(process.env.WIDTH || 6400);
  const svg = posterSVG(variant);
  const svgPath = join(OUT_DIR, variant.base + ".svg");
  const pngPath = join(OUT_DIR, variant.base + ".png");
  writeFileSync(svgPath, svg);
  const bytes = rasterize(svg, pngPath, WIDTH);
  console.log(
    `${variant.base}: SVG ${(svg.length / 1024).toFixed(0)}KB · PNG ${(bytes / 1024 / 1024).toFixed(1)}MB (${WIDTH}px)`,
  );
}
console.log("Output dir:", OUT_DIR);
