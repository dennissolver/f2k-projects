// Rasterise a PDF page to PNG (for Seafields design floor-plans dropped by Uwe).
//
// Pairs with scripts/crop-design-plan.mjs: rasterise here, then crop the
// manufacturer title block. Uses mupdf (pure WASM — no native deps; the
// Windows-friendly path after pdf-to-png-converter's pdfjs cmaps bug).
//
// Usage:
//   node scripts/rasterise-pdf.mjs "<in.pdf>" <out.png> [--page 1] [--scale 2.4]

import fs from "fs";
import * as mupdf from "mupdf";

function arg(flag, def) {
  const i = process.argv.indexOf(flag);
  return i === -1 || i + 1 >= process.argv.length ? def : process.argv[i + 1];
}

const [, , input, output] = process.argv;
if (!input || !output) {
  console.error('usage: node scripts/rasterise-pdf.mjs "<in.pdf>" <out.png> [--page N] [--scale S]');
  process.exit(1);
}

const pageNo = Math.max(1, parseInt(arg("--page", "1"), 10));
const scale = parseFloat(arg("--scale", "2.4"));

const doc = mupdf.Document.openDocument(fs.readFileSync(input), "application/pdf");
if (pageNo > doc.countPages()) {
  console.error(`page ${pageNo} out of range (doc has ${doc.countPages()})`);
  process.exit(1);
}
const page = doc.loadPage(pageNo - 1);
const pix = page.toPixmap(mupdf.Matrix.scale(scale, scale), mupdf.ColorSpace.DeviceRGB, false, true);
fs.writeFileSync(output, Buffer.from(pix.asPNG()));
console.log(`rasterised ${input} p${pageNo} @${scale}x -> ${output}`);
