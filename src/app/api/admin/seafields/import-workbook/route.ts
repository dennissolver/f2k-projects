import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getAdminUser, hasPermission, auditLog } from "@/lib/admin-auth";
import { createSupabaseService } from "@/lib/supabase-service";

// ---------------------------------------------------------------------------
// Phase 4.2 — Seafields workbook merge endpoint.
//
// Re-runnable selective merge per the column-ownership doctrine
// ([[seafields-workbook-merge-policy]]):
//   * DA plan owns lot_number, area_m2, zoning code — never touched here.
//   * Workbook owns stage assignment, allocation_bucket, status, pricing
//     overrides, dwelling_type FK, display flags, internal_notes — merged in.
//
// Lots in the workbook not in the DB → orphan log, skipped.
// Lots in the DB not in the workbook → left untouched (workbook silent ≠ clear).
// Blank workbook cells on otherwise-matched lots → skipped (no opinion ≠ clear).
//
// Audit attribution today: one app-level summary row per import, plus the
// per-field trigger rows that fire with actor_email='system' until session-var
// plumbing lands ([[seafields-phase-4-3-next-session]] item 3).
// ---------------------------------------------------------------------------

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB — workbook is currently ~30KB

const ALLOCATION_BUCKETS = [
  "public",
  "groh",
  "baurimus",
  "takken",
  "wachs",
  "f2k_withheld",
  "display_home",
  "heritage_retained",
] as const;
type AllocationBucket = (typeof ALLOCATION_BUCKETS)[number];

const STATUSES = [
  "available",
  "reserved",
  "withheld",
  "sold",
  "backup_list_only",
] as const;
type Status = (typeof STATUSES)[number];

const CATEGORIES = [
  "compact",
  "standard",
  "large",
  "premium",
  "heritage",
] as const;
type Category = (typeof CATEGORIES)[number];

interface StageRow {
  id: string;
  stage_number: number;
  stage_label: string;
  rate_per_sqm: number | null;
}
interface DwellingTypeRow {
  id: string;
  code: string;
  plan_name: string;
  bedrooms: number | null;
  bathrooms: number | null;
  floor_area_sqm: number | null;
  build_cost_default: number | null;
}
interface LotRow {
  lot_number: number;
  category: Category | null;
  zone: string | null;
  stage: string | null;
  stage_id: string | null;
  status: Status;
  allocated_to: string | null;
  allocation_bucket: AllocationBucket | null;
  dwelling_type_id: string | null;
  land_only: boolean;
  land_rate_override_per_sqm: number | null;
  house_cost: number | null;
  display_price_to_public: boolean;
  public_label: string | null;
  internal_notes: string | null;
}

interface LotChange {
  lot_number: number;
  changes: Record<string, unknown>;
}
interface ImportSummary {
  dryRun: boolean;
  reason: string | null;
  stages: {
    upserted: Array<{ stage_number: number; changes: Record<string, unknown> }>;
    no_op: number;
  };
  dwelling_types: {
    upserted: Array<{ code: string; changes: Record<string, unknown> }>;
    inserted: Array<{ code: string }>;
    no_op: number;
  };
  lots: {
    total_in_workbook: number;
    matched: number;
    updated: LotChange[];
    no_op: number;
    orphans: Array<{ lot_number: number; reason: string }>;
  };
  gap_lots: number[];
  warnings: string[];
  errors: string[];
}

// ---------------------------------------------------------------------------
// xlsx helpers — header-based parsing so column reordering doesn't break us
// ---------------------------------------------------------------------------

type Cell = string | number | boolean | null;
type Row = Cell[];

function sheetRows(wb: XLSX.WorkBook, name: string): Row[] {
  const ws = wb.Sheets[name];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json<Row>(ws, {
    header: 1,
    defval: null,
    blankrows: false,
    raw: true,
  });
}

function findHeaderRow(rows: Row[], required: string[]): {
  rowIndex: number;
  header: Record<string, number>;
} | null {
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const cells = rows[i] ?? [];
    const map: Record<string, number> = {};
    for (let j = 0; j < cells.length; j++) {
      const v = cells[j];
      if (typeof v === "string" && v.trim()) map[v.trim()] = j;
    }
    if (required.every((h) => h in map)) {
      return { rowIndex: i, header: map };
    }
  }
  return null;
}

function strOrNull(v: Cell): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}
function numOrNull(v: Cell): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[$,]/g, ""));
  return Number.isFinite(n) ? n : null;
}
function yn(v: Cell): boolean | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "boolean") return v;
  const s = String(v).trim().toLowerCase();
  if (s === "y" || s === "yes" || s === "true") return true;
  if (s === "n" || s === "no" || s === "false") return false;
  return null;
}

// ---------------------------------------------------------------------------
// Domain helpers
// ---------------------------------------------------------------------------

function deriveAllocationBucket(allocatedTo: string | null): {
  bucket: AllocationBucket | null;
  allocated_to: string | null;
  matched: boolean;
} {
  if (allocatedTo === null) {
    return { bucket: "public", allocated_to: null, matched: true };
  }
  const lower = allocatedTo.toLowerCase();
  if (lower === "public") return { bucket: "public", allocated_to: null, matched: true };
  if (lower.startsWith("wachs")) return { bucket: "wachs", allocated_to: allocatedTo, matched: true };
  if (lower.startsWith("groh")) return { bucket: "groh", allocated_to: allocatedTo, matched: true };
  if (lower.includes("takken")) return { bucket: "takken", allocated_to: allocatedTo, matched: true };
  if (lower.includes("baurimus")) return { bucket: "baurimus", allocated_to: allocatedTo, matched: true };
  if (lower.includes("f2k")) return { bucket: "f2k_withheld", allocated_to: allocatedTo, matched: true };
  if (lower.includes("display") || lower.includes("home")) {
    return { bucket: "display_home", allocated_to: allocatedTo, matched: true };
  }
  if (lower.includes("heritage")) {
    return { bucket: "heritage_retained", allocated_to: allocatedTo, matched: true };
  }
  // Unknown — leave bucket NULL, keep raw text, flag in warnings.
  return { bucket: null, allocated_to: allocatedTo, matched: false };
}

function normaliseStatus(v: string | null): Status | null {
  if (v === null) return null;
  const s = v.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return (STATUSES as readonly string[]).includes(s) ? (s as Status) : null;
}

function normaliseCategory(v: string | null): Category | null {
  if (v === null) return null;
  const s = v.trim().toLowerCase();
  return (CATEGORIES as readonly string[]).includes(s) ? (s as Category) : null;
}

function parseStageNumberFromCell(v: Cell): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 7) return v;
  const m = String(v).trim().match(/^Stage\s+([1-7])$/i);
  return m ? Number(m[1]) : null;
}

// Build patch of fields whose workbook value differs from current DB value.
// Blank workbook cells (null) are skipped — workbook silent ≠ clear.
function buildLotPatch(
  workbook: Partial<LotRow>,
  dbRow: LotRow,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  const keys: Array<keyof LotRow> = [
    "category",
    "zone",
    "stage",
    "stage_id",
    "status",
    "allocated_to",
    "allocation_bucket",
    "dwelling_type_id",
    "land_only",
    "land_rate_override_per_sqm",
    "house_cost",
    "display_price_to_public",
    "public_label",
    "internal_notes",
  ];
  for (const k of keys) {
    const wv = workbook[k];
    if (wv === undefined) continue; // not derived from workbook this row
    if (wv === null) continue; // blank cell — don't clobber
    const cur = dbRow[k];
    if (wv !== cur) patch[k as string] = wv;
  }
  return patch;
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (!admin || !hasPermission(admin.role, "manage_seafields_import")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing `file` (xlsx upload)" }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: `File too large (max ${MAX_FILE_BYTES / 1024 / 1024} MB)` },
      { status: 413 },
    );
  }

  const dryRunRaw = form.get("dryRun");
  const dryRun = dryRunRaw === null ? true : String(dryRunRaw) !== "false";

  const reasonRaw = form.get("reason");
  const reason = typeof reasonRaw === "string" ? reasonRaw.trim() : "";
  if (!dryRun && reason.length < 10) {
    return NextResponse.json(
      { error: "A reason (≥10 chars) is required when applying (dryRun=false)." },
      { status: 400 },
    );
  }

  // Parse workbook
  let wb: XLSX.WorkBook;
  try {
    const buf = await file.arrayBuffer();
    wb = XLSX.read(new Uint8Array(buf), { type: "array", cellDates: false });
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to parse workbook: ${(err as Error).message}` },
      { status: 400 },
    );
  }

  const summary: ImportSummary = {
    dryRun,
    reason: reason || null,
    stages: { upserted: [], no_op: 0 },
    dwelling_types: { upserted: [], inserted: [], no_op: 0 },
    lots: {
      total_in_workbook: 0,
      matched: 0,
      updated: [],
      no_op: 0,
      orphans: [],
    },
    gap_lots: [],
    warnings: [],
    errors: [],
  };

  const supabase = createSupabaseService();

  // -------------------------------------------------------------------------
  // Stages — workbook owns stage_label + rate_per_sqm; gating fields untouched.
  // -------------------------------------------------------------------------
  const { data: stagesData, error: stagesErr } = await (
    supabase.from("stages") as any
  )
    .select("id, stage_number, stage_label, rate_per_sqm")
    .order("stage_number");
  if (stagesErr) {
    return NextResponse.json({ error: `stages fetch: ${stagesErr.message}` }, { status: 500 });
  }
  const stagesByNumber = new Map<number, StageRow>(
    ((stagesData ?? []) as StageRow[]).map((s) => [s.stage_number, s]),
  );

  const ladderRows = sheetRows(wb, "Stage_Pricing_Ladder");
  const ladderHeader = findHeaderRow(ladderRows, ["Stage", "Stage Label", "Land $/m² (retail)"]);
  if (!ladderHeader) {
    summary.warnings.push("Stage_Pricing_Ladder: header row not found — stages skipped");
  } else {
    const { rowIndex, header } = ladderHeader;
    for (let i = rowIndex + 1; i < ladderRows.length; i++) {
      const row = ladderRows[i] ?? [];
      const stageNumber = parseStageNumberFromCell(row[header["Stage"]]);
      if (stageNumber === null) continue;
      const stageLabel = strOrNull(row[header["Stage Label"]]);
      const rate = numOrNull(row[header["Land $/m² (retail)"]]);

      const existing = stagesByNumber.get(stageNumber);
      if (!existing) {
        summary.warnings.push(`Stage ${stageNumber} in workbook but not in DB`);
        continue;
      }

      const patch: Record<string, unknown> = {};
      if (stageLabel !== null && stageLabel !== existing.stage_label) {
        patch.stage_label = stageLabel;
      }
      if (rate !== null && rate !== existing.rate_per_sqm) {
        patch.rate_per_sqm = rate;
      }
      if (Object.keys(patch).length === 0) {
        summary.stages.no_op += 1;
        continue;
      }
      summary.stages.upserted.push({ stage_number: stageNumber, changes: patch });

      if (!dryRun) {
        const { error: updErr } = await (supabase.from("stages") as any)
          .update(patch)
          .eq("id", existing.id);
        if (updErr) summary.errors.push(`stage ${stageNumber}: ${updErr.message}`);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Dwelling types — upsert by `code`.
  // -------------------------------------------------------------------------
  const { data: dtData, error: dtErr } = await (
    supabase.from("dwelling_types") as any
  ).select(
    "id, code, plan_name, bedrooms, bathrooms, floor_area_sqm, build_cost_default",
  );
  if (dtErr) {
    return NextResponse.json({ error: `dwelling_types fetch: ${dtErr.message}` }, { status: 500 });
  }
  const dwellingByCode = new Map<string, DwellingTypeRow>(
    ((dtData ?? []) as DwellingTypeRow[]).map((d) => [d.code, d]),
  );

  const dtRows = sheetRows(wb, "Dwelling_Types");
  const dtHeader = findHeaderRow(dtRows, ["Code", "Plan Name"]);
  if (!dtHeader) {
    summary.warnings.push("Dwelling_Types: header row not found — dwelling types skipped");
  } else {
    const { rowIndex, header } = dtHeader;
    for (let i = rowIndex + 1; i < dtRows.length; i++) {
      const row = dtRows[i] ?? [];
      const code = strOrNull(row[header["Code"]]);
      if (!code) continue;
      const planName = strOrNull(row[header["Plan Name"]]);
      if (!planName) {
        summary.warnings.push(`Dwelling code ${code}: missing Plan Name`);
        continue;
      }
      const bedrooms = numOrNull(row[header["Bedrooms"]]);
      const bathrooms = numOrNull(row[header["Bathrooms"]]);
      const floorArea = numOrNull(row[header["Floor Area (m²)"]]);
      const buildCost = numOrNull(row[header["Build Cost $"]]);
      const notes = strOrNull(row[header["Notes / Use Case"]] ?? null);

      const existing = dwellingByCode.get(code);
      if (!existing) {
        summary.dwelling_types.inserted.push({ code });
        if (!dryRun) {
          const { error } = await (supabase.from("dwelling_types") as any).insert({
            code,
            plan_name: planName,
            bedrooms,
            bathrooms,
            floor_area_sqm: floorArea,
            build_cost_default: buildCost,
            notes,
          });
          if (error) summary.errors.push(`dwelling insert ${code}: ${error.message}`);
        }
        continue;
      }

      const patch: Record<string, unknown> = {};
      if (planName !== existing.plan_name) patch.plan_name = planName;
      if (bedrooms !== null && bedrooms !== existing.bedrooms) patch.bedrooms = bedrooms;
      if (bathrooms !== null && bathrooms !== existing.bathrooms) patch.bathrooms = bathrooms;
      if (floorArea !== null && floorArea !== existing.floor_area_sqm) {
        patch.floor_area_sqm = floorArea;
      }
      if (buildCost !== null && buildCost !== existing.build_cost_default) {
        patch.build_cost_default = buildCost;
      }
      if (Object.keys(patch).length === 0) {
        summary.dwelling_types.no_op += 1;
        continue;
      }
      summary.dwelling_types.upserted.push({ code, changes: patch });
      if (!dryRun) {
        const { error } = await (supabase.from("dwelling_types") as any)
          .update(patch)
          .eq("id", existing.id);
        if (error) summary.errors.push(`dwelling update ${code}: ${error.message}`);
      }
    }
  }

  // Refresh dwelling lookup so lot rows can resolve newly-inserted codes
  // in the same dry-run summary.
  if (!dryRun && summary.dwelling_types.inserted.length > 0) {
    const { data: refresh } = await (supabase.from("dwelling_types") as any).select(
      "id, code, plan_name, bedrooms, bathrooms, floor_area_sqm, build_cost_default",
    );
    dwellingByCode.clear();
    for (const d of (refresh ?? []) as DwellingTypeRow[]) {
      dwellingByCode.set(d.code, d);
    }
  }

  // -------------------------------------------------------------------------
  // Lots — workbook owns allocation/pricing/dwelling FK/status/display flags.
  // DA owns lot_number + area_m2 + zoning code (zone column here is the
  // workbook block-name, semantically separate from DA's R20 zoning code).
  // -------------------------------------------------------------------------
  // Refresh stages map for lot stage_id lookup (rates may have changed)
  if (!dryRun && summary.stages.upserted.length > 0) {
    const { data: refresh } = await (supabase.from("stages") as any).select(
      "id, stage_number, stage_label, rate_per_sqm",
    );
    stagesByNumber.clear();
    for (const s of (refresh ?? []) as StageRow[]) {
      stagesByNumber.set(s.stage_number, s);
    }
  }

  const { data: lotsData, error: lotsErr } = await (
    supabase.from("seafields_lot_allocations") as any
  ).select(
    "lot_number, category, zone, stage, stage_id, status, allocated_to, allocation_bucket, dwelling_type_id, land_only, land_rate_override_per_sqm, house_cost, display_price_to_public, public_label, internal_notes",
  );
  if (lotsErr) {
    return NextResponse.json({ error: `lots fetch: ${lotsErr.message}` }, { status: 500 });
  }
  const lotsByNumber = new Map<number, LotRow>(
    ((lotsData ?? []) as LotRow[]).map((l) => [l.lot_number, l]),
  );

  const lotRows = sheetRows(wb, "Lot_Allocation_Master");
  const lotHeader = findHeaderRow(lotRows, ["Lot #", "Stage", "Allocated To"]);
  if (!lotHeader) {
    summary.errors.push("Lot_Allocation_Master: header row not found");
  } else {
    const { rowIndex, header } = lotHeader;
    const seenLots = new Set<number>();
    for (let i = rowIndex + 1; i < lotRows.length; i++) {
      const row = lotRows[i] ?? [];
      const lotNumber = numOrNull(row[header["Lot #"]]);
      if (lotNumber === null || !Number.isInteger(lotNumber)) continue;
      summary.lots.total_in_workbook += 1;
      seenLots.add(lotNumber);

      const dbRow = lotsByNumber.get(lotNumber);
      if (!dbRow) {
        summary.lots.orphans.push({
          lot_number: lotNumber,
          reason: "Workbook lot not in DB (DA plan governs membership)",
        });
        continue;
      }
      summary.lots.matched += 1;

      // Map workbook cells → typed values
      const wbCategory = normaliseCategory(strOrNull(row[header["Category"]]));
      if (header["Category"] !== undefined && row[header["Category"]] && wbCategory === null) {
        summary.warnings.push(
          `Lot ${lotNumber}: unknown Category "${row[header["Category"]]}" — left untouched`,
        );
      }
      const wbZone = strOrNull(row[header["Zone / Block"]]);
      const wbStageNum = parseStageNumberFromCell(row[header["Stage"]]);
      let wbStageId: string | null | undefined = undefined;
      let wbStageText: string | null | undefined = undefined;
      if (wbStageNum !== null) {
        const stg = stagesByNumber.get(wbStageNum);
        if (!stg) {
          summary.warnings.push(`Lot ${lotNumber}: stage ${wbStageNum} not in stages table`);
        } else {
          wbStageId = stg.id;
          wbStageText = String(wbStageNum);
        }
      }
      const wbStatus = normaliseStatus(strOrNull(row[header["Status"]]));
      if (header["Status"] !== undefined && row[header["Status"]] && wbStatus === null) {
        summary.warnings.push(
          `Lot ${lotNumber}: unknown Status "${row[header["Status"]]}" — left untouched`,
        );
      }
      const allocRaw = strOrNull(row[header["Allocated To"]]);
      const alloc = deriveAllocationBucket(allocRaw);
      if (!alloc.matched && allocRaw) {
        summary.warnings.push(
          `Lot ${lotNumber}: allocated_to "${allocRaw}" did not match any bucket — bucket left untouched`,
        );
      }
      const dwellCode = strOrNull(row[header["Dwelling Type"]]);
      let wbDwellingTypeId: string | null | undefined = undefined;
      if (dwellCode) {
        const dt = dwellingByCode.get(dwellCode);
        if (!dt) {
          summary.warnings.push(
            `Lot ${lotNumber}: dwelling code "${dwellCode}" not found in dwelling_types`,
          );
        } else {
          wbDwellingTypeId = dt.id;
        }
      }
      const wbLandOnly = yn(row[header["Land Only? (Y/N)"]]);
      const wbDisplay = yn(row[header["Display Price?"]]);

      const workbookValues: Partial<LotRow> = {
        category: wbCategory ?? undefined,
        zone: wbZone ?? undefined,
        stage: wbStageText,
        stage_id: wbStageId,
        status: wbStatus ?? undefined,
        allocated_to: alloc.matched ? alloc.allocated_to : undefined,
        allocation_bucket: alloc.matched ? alloc.bucket : undefined,
        dwelling_type_id: wbDwellingTypeId,
        land_only: wbLandOnly ?? undefined,
        land_rate_override_per_sqm:
          numOrNull(row[header["Land $/m² Override"]]) ?? undefined,
        house_cost: numOrNull(row[header["House $ (if H&L)"]]) ?? undefined,
        display_price_to_public: wbDisplay ?? undefined,
        public_label: strOrNull(row[header["Public Label"]]) ?? undefined,
        internal_notes:
          strOrNull(row[header["Notes / Uwe Comments"]]) ?? undefined,
      };

      const patch = buildLotPatch(workbookValues, dbRow);
      if (Object.keys(patch).length === 0) {
        summary.lots.no_op += 1;
        continue;
      }
      summary.lots.updated.push({ lot_number: lotNumber, changes: patch });

      if (!dryRun) {
        const { error } = await (supabase.from("seafields_lot_allocations") as any)
          .update(patch)
          .eq("lot_number", lotNumber);
        if (error) summary.errors.push(`lot ${lotNumber}: ${error.message}`);
      }
    }
    // Gap lots — in DB but not in workbook
    for (const [num] of lotsByNumber) {
      if (!seenLots.has(num)) summary.gap_lots.push(num);
    }
    summary.gap_lots.sort((a, b) => a - b);
  }

  // -------------------------------------------------------------------------
  // Audit log — one summary row per apply.
  // -------------------------------------------------------------------------
  if (!dryRun) {
    await auditLog(
      admin.id,
      admin.email,
      "seafields_workbook_imported",
      "seafields_lot_allocation",
      null,
      {
        reason,
        file_name: file.name,
        file_size: file.size,
        stages_changed: summary.stages.upserted.length,
        dwelling_types_changed:
          summary.dwelling_types.upserted.length +
          summary.dwelling_types.inserted.length,
        lots_updated: summary.lots.updated.length,
        lots_orphans: summary.lots.orphans.length,
        gap_lots_count: summary.gap_lots.length,
        warnings_count: summary.warnings.length,
        errors_count: summary.errors.length,
      },
    );
  }

  return NextResponse.json(summary);
}
