// Offline parser sanity check — no DB, no auth.
// Confirms `xlsx` parses the workbook with the header names the endpoint expects.
import { readFile } from 'node:fs/promises';
import * as XLSX from 'xlsx';

const buf = await readFile('docs/Seafields_Lot_Allocation_Master_V1.xlsx');
const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });

function sheetRows(name) {
  const ws = wb.Sheets[name];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false, raw: true });
}

function findHeaderRow(rows, required) {
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const cells = rows[i] ?? [];
    const map = {};
    for (let j = 0; j < cells.length; j++) {
      const v = cells[j];
      if (typeof v === 'string' && v.trim()) map[v.trim()] = j;
    }
    if (required.every((h) => h in map)) return { rowIndex: i, header: map };
  }
  return null;
}

console.log('Sheets:', wb.SheetNames);

// Stage_Pricing_Ladder
const ladder = sheetRows('Stage_Pricing_Ladder');
const ladderHdr = findHeaderRow(ladder, ['Stage', 'Stage Label', 'Land $/m² (retail)']);
console.log('\n[Stage_Pricing_Ladder]');
if (!ladderHdr) {
  console.log('  ✗ Header row not found');
} else {
  console.log('  ✓ Header row at index', ladderHdr.rowIndex);
  let count = 0;
  for (let i = ladderHdr.rowIndex + 1; i < ladder.length; i++) {
    const row = ladder[i] ?? [];
    const cell = row[ladderHdr.header['Stage']];
    if (typeof cell === 'string' && /^Stage\s+[1-7]$/i.test(cell)) {
      console.log(`    ${cell} | label=${row[ladderHdr.header['Stage Label']]} | rate=${row[ladderHdr.header['Land $/m² (retail)']]}`);
      count++;
    }
  }
  console.log(`  → ${count} stages parsed`);
}

// Dwelling_Types
const dt = sheetRows('Dwelling_Types');
const dtHdr = findHeaderRow(dt, ['Code', 'Plan Name']);
console.log('\n[Dwelling_Types]');
if (!dtHdr) {
  console.log('  ✗ Header row not found');
} else {
  console.log('  ✓ Header row at index', dtHdr.rowIndex);
  let count = 0;
  for (let i = dtHdr.rowIndex + 1; i < dt.length; i++) {
    const row = dt[i] ?? [];
    const code = row[dtHdr.header['Code']];
    if (typeof code === 'string' && code.trim()) {
      console.log(`    ${code} | plan=${row[dtHdr.header['Plan Name']]} | beds=${row[dtHdr.header['Bedrooms']]} | floor=${row[dtHdr.header['Floor Area (m²)']]} | cost=${row[dtHdr.header['Build Cost $']]}`);
      count++;
    }
  }
  console.log(`  → ${count} dwelling types parsed`);
}

// Lot_Allocation_Master
const lots = sheetRows('Lot_Allocation_Master');
const lotHdr = findHeaderRow(lots, ['Lot #', 'Stage', 'Allocated To']);
console.log('\n[Lot_Allocation_Master]');
if (!lotHdr) {
  console.log('  ✗ Header row not found');
} else {
  console.log('  ✓ Header row at index', lotHdr.rowIndex);
  console.log('  Columns mapped:', Object.keys(lotHdr.header).filter(k =>
    ['Lot #','Area (m²)','Category','Zone / Block','Stage','Status','Allocated To','Dwelling Type','Land Only? (Y/N)','Land $/m² Override','Calc Land $','House $ (if H&L)','Total H&L $','Display Price?','Public Label','Notes / Uwe Comments'].includes(k)));
  let count = 0;
  const stageTally = {};
  const allocTally = {};
  for (let i = lotHdr.rowIndex + 1; i < lots.length; i++) {
    const row = lots[i] ?? [];
    const ln = row[lotHdr.header['Lot #']];
    if (typeof ln === 'number' && Number.isInteger(ln)) {
      count++;
      const st = row[lotHdr.header['Stage']];
      const al = row[lotHdr.header['Allocated To']];
      stageTally[st ?? 'NULL'] = (stageTally[st ?? 'NULL'] || 0) + 1;
      allocTally[al ?? 'NULL'] = (allocTally[al ?? 'NULL'] || 0) + 1;
    }
  }
  console.log(`  → ${count} lots parsed`);
  console.log('  Stage tally:', stageTally);
  console.log('  Allocated To tally:', allocTally);
}
