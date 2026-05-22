// @explanatory-header-exempt — nested workflow page; entry-point header lives on the parent surface
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import AdminLotMap, {
  type LotAllocationLite,
} from "@/components/seafields/admin/AdminLotMap";
import AdminLotEditModal, {
  type FullAllocation,
} from "@/components/seafields/admin/AdminLotEditModal";

interface Allocation {
  lot_number: number;
  sqm: number;
  allocated_to: string | null;
  dwelling_type: string | null;
  stage: string | null;
  x_pct: number | null;
  y_pct: number | null;
  assigned_at: string | null;
  updated_at: string;
  notes: string | null;
  wholesale_price: number | null;
  retail_price: number | null;
  intent_locked_to_registration_id: string | null;
  intent_locked_at: string | null;
  intent_locked_by: string | null;
  // Typed columns added in migration 0003 (surfaced by the GET endpoint)
  status:
    | "available"
    | "reserved"
    | "withheld"
    | "sold"
    | "backup_list_only"
    | null;
  allocation_bucket:
    | "public"
    | "groh"
    | "baurimus"
    | "takken"
    | "wachs"
    | "f2k_withheld"
    | "display_home"
    | "heritage_retained"
    | null;
  stage_id: string | null;
  dwelling_type_id: string | null;
  category: string | null;
  zone: string | null;
  land_only: boolean | null;
  land_rate_override_per_sqm: number | null;
  house_cost: number | null;
  display_price_to_public: boolean | null;
  public_label: string | null;
  internal_notes: string | null;
  // Migration 0011 — R20 planning reality (CLE 2026-05-21)
  subdivisible: boolean | null;
  ancillary_dwelling_eligible: boolean | null;
}

const STAGE_COLOR: Record<string, string> = {
  "1": "bg-sky-100 text-sky-800 border-sky-300",
  "2": "bg-amber-50 text-amber-800 border-amber-300",
  "3": "bg-rose-100 text-rose-800 border-rose-300",
  "4": "bg-yellow-100 text-yellow-800 border-yellow-300",
  "5": "bg-emerald-100 text-emerald-800 border-emerald-300",
  "6": "bg-purple-100 text-purple-800 border-purple-300",
  "7": "bg-gray-200 text-gray-800 border-gray-400",
};

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "available", label: "Available" },
  { value: "reserved", label: "Reserved" },
  { value: "sold", label: "Sold" },
  { value: "withheld", label: "Withheld" },
  { value: "backup_list_only", label: "Backup list only" },
  { value: "unset", label: "(no status)" },
];

const BUCKET_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All buckets" },
  { value: "public", label: "Public" },
  { value: "groh", label: "GROH" },
  { value: "baurimus", label: "Baurimus" },
  { value: "takken", label: "Takken" },
  { value: "wachs", label: "Wachs" },
  { value: "f2k_withheld", label: "F2K withheld" },
  { value: "display_home", label: "Display home" },
  { value: "heritage_retained", label: "Heritage retained" },
];

// Sort priority for status when used as a sort key.
const STATUS_SORT_ORDER: Record<string, number> = {
  available: 0,
  reserved: 1,
  sold: 2,
  withheld: 3,
  backup_list_only: 4,
};

type SortKey =
  | "lot_number"
  | "sqm"
  | "allocated"
  | "stage"
  | "dwelling_type"
  | "land_price"
  | "interest";
type SortDir = "asc" | "desc";

function landPriceOf(r: { retail_price: number | null; wholesale_price: number | null }): number | null {
  return r.retail_price ?? r.wholesale_price ?? null;
}

function formatCurrency(n: number | null): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(n);
}

function SortableTh({
  label,
  sortKey: key,
  activeKey,
  dir,
  onClick,
  align = "left",
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  dir: SortDir;
  onClick: (k: SortKey) => void;
  align?: "left" | "right";
}) {
  const isActive = activeKey === key;
  const arrow = isActive ? (dir === "asc" ? "▲" : "▼") : "";
  return (
    <th
      onClick={() => onClick(key)}
      className={`px-3 py-2 cursor-pointer select-none hover:bg-slate-100 ${
        align === "right" ? "text-right" : "text-left"
      } ${isActive ? "text-slate-900" : ""}`}
      title={`Sort by ${label.toLowerCase()}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <span className="text-[10px] w-2 text-slate-400">{arrow}</span>
      </span>
    </th>
  );
}

export default function SeafieldsLotsPage() {
  const [rows, setRows] = useState<Allocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<{
    lotNumber: number;
    lotId: string;
  } | null>(null);
  const [interestCounts, setInterestCounts] = useState<Record<string, number>>(
    {},
  );
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [filterAllocated, setFilterAllocated] = useState<
    "all" | "allocated" | "available"
  >("all");
  const [filterStage, setFilterStage] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterBucket, setFilterBucket] = useState<string>("all");
  const [filterDwelling, setFilterDwelling] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("lot_number");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const [allocRes, countsRes] = await Promise.all([
        fetch("/api/admin/seafields/allocations"),
        // Investor-portal counts endpoint shows interest per lot — admin can use the same
        fetch("/api/admin/seafields/lots"),
      ]);
      if (allocRes.ok) {
        const data = await allocRes.json();
        setRows(data.allocations || []);
      } else {
        setMessage({ type: "error", text: "Failed to load allocations" });
      }
      if (countsRes.ok) {
        const data = await countsRes.json();
        setInterestCounts(data.counts || {});
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const allocByNumber = useMemo(() => {
    const map: Record<number, LotAllocationLite> = {};
    for (const r of rows) {
      map[r.lot_number] = {
        lot_number: r.lot_number,
        allocated_to: r.allocated_to,
        intent_locked_to_registration_id: r.intent_locked_to_registration_id,
        status: r.status,
        allocation_bucket: r.allocation_bucket,
      };
    }
    return map;
  }, [rows]);

  const dwellingOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const r of rows) {
      if (r.dwelling_type && r.dwelling_type.trim())
        seen.add(r.dwelling_type.trim());
    }
    return Array.from(seen).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filterAllocated === "allocated" && !r.allocated_to) return false;
      if (filterAllocated === "available" && r.allocated_to) return false;
      if (filterStage !== "all") {
        if (filterStage === "unstaged" && r.stage) return false;
        if (filterStage !== "unstaged" && r.stage !== filterStage) return false;
      }
      if (filterStatus !== "all") {
        if (filterStatus === "unset" && r.status) return false;
        if (filterStatus !== "unset" && r.status !== filterStatus) return false;
      }
      if (filterBucket !== "all" && r.allocation_bucket !== filterBucket)
        return false;
      if (filterDwelling !== "all") {
        if (filterDwelling === "unset" && r.dwelling_type) return false;
        if (filterDwelling !== "unset" && r.dwelling_type !== filterDwelling)
          return false;
      }
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const hay = `${r.lot_number} ${r.allocated_to || ""} ${
          r.dwelling_type || ""
        } ${r.stage || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    rows,
    filterAllocated,
    filterStage,
    filterStatus,
    filterBucket,
    filterDwelling,
    search,
  ]);

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    const cmp = (a: Allocation, b: Allocation): number => {
      switch (sortKey) {
        case "lot_number":
          return (a.lot_number - b.lot_number) * dir;
        case "sqm":
          return ((a.sqm ?? 0) - (b.sqm ?? 0)) * dir;
        case "stage": {
          const sa = a.stage ? parseInt(a.stage, 10) : Number.POSITIVE_INFINITY;
          const sb = b.stage ? parseInt(b.stage, 10) : Number.POSITIVE_INFINITY;
          return (sa - sb) * dir;
        }
        case "dwelling_type": {
          const da = a.dwelling_type || "";
          const db = b.dwelling_type || "";
          if (!da && db) return 1; // nulls last regardless of dir
          if (da && !db) return -1;
          return da.localeCompare(db) * dir;
        }
        case "allocated": {
          // Sort by typed status first; fall back to allocated_to presence.
          const sa =
            a.status != null
              ? STATUS_SORT_ORDER[a.status] ?? 99
              : a.allocated_to
                ? 1
                : 99;
          const sb =
            b.status != null
              ? STATUS_SORT_ORDER[b.status] ?? 99
              : b.allocated_to
                ? 1
                : 99;
          return (sa - sb) * dir;
        }
        case "land_price": {
          const pa = landPriceOf(a);
          const pb = landPriceOf(b);
          if (pa == null && pb == null) return 0;
          if (pa == null) return 1; // nulls last
          if (pb == null) return -1;
          return (pa - pb) * dir;
        }
        case "interest": {
          const ia = interestCounts[`L${a.lot_number}`] || 0;
          const ib = interestCounts[`L${b.lot_number}`] || 0;
          return (ia - ib) * dir;
        }
        default:
          return 0;
      }
    };
    return [...filtered].sort(cmp);
  }, [filtered, sortKey, sortDir, interestCounts]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "lot_number" ? "asc" : "asc");
    }
  }

  const stats = useMemo(() => {
    const total = rows.length;
    const allocated = rows.filter((r) => r.allocated_to).length;
    const intentLocked = rows.filter(
      (r) => !r.allocated_to && r.intent_locked_to_registration_id,
    ).length;
    const totalRegistrations = Object.values(interestCounts).reduce(
      (s, n) => s + n,
      0,
    );
    return { total, allocated, intentLocked, totalRegistrations };
  }, [rows, interestCounts]);

  const editingAllocation: FullAllocation | null = editing
    ? rows.find((r) => r.lot_number === editing.lotNumber) || null
    : null;

  function handleSelectLot(lotId: string, lotNumber: number) {
    setEditing({ lotId, lotNumber });
  }

  function handleSaved(updated: FullAllocation) {
    setRows((prev) =>
      prev.map((r) =>
        r.lot_number === updated.lot_number ? { ...r, ...updated } : r,
      ),
    );
    setMessage({
      type: "success",
      text: `Lot ${updated.lot_number} updated`,
    });
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900 mb-1">
        Seafields Lot Allocations
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        Authoritative register for the 145-lot subdivision (CLE Plan
        3027-08B-01, WAPC 202888). Click any lot — on the map or in the
        table — to edit.
      </p>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border rounded p-4">
          <div className="text-xs uppercase tracking-wider text-slate-500">
            Total lots
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
        </div>
        <div className="bg-white border rounded p-4">
          <div className="text-xs uppercase tracking-wider text-slate-500">
            Allocated
          </div>
          <div className="text-2xl font-bold text-purple-700">
            {stats.allocated}
          </div>
        </div>
        <div className="bg-white border rounded p-4">
          <div className="text-xs uppercase tracking-wider text-slate-500">
            Soft-allocated
          </div>
          <div className="text-2xl font-bold text-amber-600">
            {stats.intentLocked}
          </div>
        </div>
        <div className="bg-white border rounded p-4">
          <div className="text-xs uppercase tracking-wider text-slate-500">
            Total interest registrations
          </div>
          <div className="text-2xl font-bold text-sky-700">
            {stats.totalRegistrations}
          </div>
        </div>
      </div>

      {message && (
        <div
          className={`mb-4 p-3 rounded text-sm ${
            message.type === "success"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center mb-4">
        <input
          type="text"
          placeholder="Search lot #, tenant, type..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border rounded px-3 py-2 text-sm w-64"
        />
        <div className="flex gap-1 bg-slate-100 rounded p-1 text-sm">
          {(
            [
              { v: "all", label: "All" },
              { v: "allocated", label: "Allocated" },
              { v: "available", label: "Available" },
            ] as const
          ).map((f) => (
            <button
              key={f.v}
              onClick={() => setFilterAllocated(f.v)}
              className={`px-3 py-1 rounded ${
                filterAllocated === f.v
                  ? "bg-white shadow-sm font-semibold text-slate-900"
                  : "text-slate-600"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-slate-100 rounded p-1 text-sm">
          <button
            onClick={() => setFilterStage("all")}
            className={`px-2 py-1 rounded ${
              filterStage === "all"
                ? "bg-white shadow-sm font-semibold text-slate-900"
                : "text-slate-600"
            }`}
          >
            All stages
          </button>
          {["1", "2", "3", "4", "5", "6", "7"].map((s) => (
            <button
              key={s}
              onClick={() => setFilterStage(s)}
              className={`px-2 py-1 rounded border ${
                filterStage === s
                  ? `${STAGE_COLOR[s]} font-semibold`
                  : "border-transparent text-slate-600"
              }`}
            >
              S{s}
            </button>
          ))}
        </div>
        <div className="text-sm text-slate-500 ml-auto">
          Showing {filtered.length} of {rows.length}
        </div>
      </div>

      {/* Secondary filters: status / bucket / dwelling type */}
      <div className="flex flex-wrap gap-3 items-center mb-4">
        <label className="text-xs uppercase tracking-wider text-slate-500">
          Status
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="ml-2 border rounded px-2 py-1 text-sm normal-case tracking-normal text-slate-800"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs uppercase tracking-wider text-slate-500">
          Bucket
          <select
            value={filterBucket}
            onChange={(e) => setFilterBucket(e.target.value)}
            className="ml-2 border rounded px-2 py-1 text-sm normal-case tracking-normal text-slate-800"
          >
            {BUCKET_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs uppercase tracking-wider text-slate-500">
          Dwelling type
          <select
            value={filterDwelling}
            onChange={(e) => setFilterDwelling(e.target.value)}
            className="ml-2 border rounded px-2 py-1 text-sm normal-case tracking-normal text-slate-800"
          >
            <option value="all">All types</option>
            <option value="unset">(no type)</option>
            {dwellingOptions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        {(filterStatus !== "all" ||
          filterBucket !== "all" ||
          filterDwelling !== "all") && (
          <button
            onClick={() => {
              setFilterStatus("all");
              setFilterBucket("all");
              setFilterDwelling("all");
            }}
            className="text-xs text-blue-600 hover:text-blue-800 underline"
          >
            Clear
          </button>
        )}
      </div>

      {/* Map + Table side-by-side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Map */}
        <div className="lg:sticky lg:top-4 self-start">
          <AdminLotMap
            allocations={allocByNumber}
            interestCounts={interestCounts}
            selectedLotId={editing?.lotId ?? null}
            onSelectLot={handleSelectLot}
          />
        </div>

        {/* Table */}
        <div className="bg-white border rounded overflow-hidden">
          {loading ? (
            <div className="p-6 text-slate-500">Loading lots…</div>
          ) : (
            <div className="overflow-x-auto" style={{ maxHeight: "78vh" }}>
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600 uppercase text-xs tracking-wider sticky top-0 z-10">
                  <tr>
                    <SortableTh
                      label="Lot"
                      sortKey="lot_number"
                      activeKey={sortKey}
                      dir={sortDir}
                      onClick={toggleSort}
                    />
                    <SortableTh
                      label="Sqm"
                      sortKey="sqm"
                      activeKey={sortKey}
                      dir={sortDir}
                      onClick={toggleSort}
                    />
                    <SortableTh
                      label="Allocated"
                      sortKey="allocated"
                      activeKey={sortKey}
                      dir={sortDir}
                      onClick={toggleSort}
                    />
                    <SortableTh
                      label="Stage"
                      sortKey="stage"
                      activeKey={sortKey}
                      dir={sortDir}
                      onClick={toggleSort}
                    />
                    <SortableTh
                      label="Type"
                      sortKey="dwelling_type"
                      activeKey={sortKey}
                      dir={sortDir}
                      onClick={toggleSort}
                    />
                    <SortableTh
                      label="Land price"
                      sortKey="land_price"
                      activeKey={sortKey}
                      dir={sortDir}
                      onClick={toggleSort}
                      align="right"
                    />
                    <SortableTh
                      label="Interest"
                      sortKey="interest"
                      activeKey={sortKey}
                      dir={sortDir}
                      onClick={toggleSort}
                      align="right"
                    />
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((row) => {
                    const lotId = `L${row.lot_number}`;
                    const interest = interestCounts[lotId] || 0;
                    const isSelected =
                      editing?.lotNumber === row.lot_number;
                    const hasIntent = !!row.intent_locked_to_registration_id;
                    const landPrice = landPriceOf(row);
                    return (
                      <tr
                        key={row.lot_number}
                        className={`border-t hover:bg-slate-50 cursor-pointer ${
                          isSelected ? "bg-blue-50" : ""
                        }`}
                        onClick={() =>
                          setEditing({ lotId, lotNumber: row.lot_number })
                        }
                      >
                        <td className="px-3 py-2 font-semibold">
                          {row.lot_number}
                        </td>
                        <td className="px-3 py-2">{row.sqm}</td>
                        <td className="px-3 py-2">
                          {row.allocated_to ? (
                            <span className="inline-block bg-purple-100 text-purple-800 px-2 py-0.5 rounded text-xs font-medium">
                              {row.allocated_to}
                            </span>
                          ) : hasIntent ? (
                            <span className="inline-block bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-xs font-medium">
                              Soft
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {row.stage ? (
                            <span
                              className={`inline-block border px-2 py-0.5 rounded text-xs font-semibold ${
                                STAGE_COLOR[row.stage] ||
                                "bg-slate-100 text-slate-800 border-slate-300"
                              }`}
                            >
                              S{row.stage}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {row.dwelling_type ? (
                            <span className="text-slate-700 text-xs">
                              {row.dwelling_type}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap text-slate-700 text-xs">
                          {landPrice != null ? (
                            formatCurrency(landPrice)
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {interest > 0 ? (
                            <span className="inline-block bg-sky-100 text-sky-800 px-2 py-0.5 rounded text-xs font-medium">
                              {interest}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditing({
                                lotId,
                                lotNumber: row.lot_number,
                              });
                            }}
                            className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {editing && (
        <AdminLotEditModal
          lotNumber={editing.lotNumber}
          lotId={editing.lotId}
          allocation={editingAllocation}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
