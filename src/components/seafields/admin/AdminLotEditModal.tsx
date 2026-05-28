"use client";

import { useEffect, useMemo, useState } from "react";
import { LOTS } from "@/data/seafields";
import AdminLotWaitlist from "./AdminLotWaitlist";

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

const BUCKET_LABELS: Record<AllocationBucket, string> = {
  public: "Public (open market)",
  groh: "GROH",
  wachs: "WACHS",
  takken: "Tarken",
  baurimus: "Baurimus",
  f2k_withheld: "F2K withheld",
  display_home: "Display home",
  heritage_retained: "Heritage retained",
};

const STATUSES = [
  "available",
  "reserved",
  "withheld",
  "sold",
  "backup_list_only",
] as const;
type Status = (typeof STATUSES)[number];

const STATUS_LABELS: Record<Status, string> = {
  available: "Available",
  reserved: "Reserved",
  withheld: "Withheld",
  sold: "Sold",
  backup_list_only: "Backup list only",
};

export interface FullAllocation {
  lot_number: number;
  sqm: number;
  allocated_to: string | null;
  dwelling_type: string | null;
  stage: string | null;
  notes: string | null;
  wholesale_price: number | null;
  retail_price: number | null;
  intent_locked_to_registration_id: string | null;
  intent_locked_at: string | null;
  assigned_at: string | null;
  updated_at: string;
  // New typed columns
  status: Status | null;
  allocation_bucket: AllocationBucket | null;
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
  // Migration 0011 — R20 planning reality (CLE 2026-05-21). Read-only here.
  subdivisible: boolean | null;
  ancillary_dwelling_eligible: boolean | null;
}

interface StageOption {
  id: string;
  stage_number: number;
  stage_label: string;
  rate_per_sqm: number | null;
}

interface DwellingOption {
  id: string;
  code: string;
  plan_name: string;
  is_active: boolean;
}

interface Props {
  lotNumber: number;
  lotId: string;
  allocation: FullAllocation | null;
  onClose: () => void;
  onSaved: (a: FullAllocation) => void;
}

// Material fields: changing any of these requires a reason ≥10 chars.
const MATERIAL_KEYS = [
  "status",
  "allocated_to",
  "allocation_bucket",
  "stage_id",
  "land_rate_override_per_sqm",
  "house_cost",
  "wholesale_price",
  "retail_price",
  "display_price_to_public",
  "public_label",
] as const;

type MaterialKey = (typeof MATERIAL_KEYS)[number];

function numToStr(n: number | null | undefined): string {
  return n == null ? "" : String(n);
}

function strToNum(s: string): number | null {
  if (s.trim() === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export default function AdminLotEditModal({
  lotNumber,
  lotId,
  allocation,
  onClose,
  onSaved,
}: Props) {
  const lotMeta = LOTS.find((l) => l.lotNumber === lotNumber);

  // Form state
  const [allocatedTo, setAllocatedTo] = useState(allocation?.allocated_to ?? "");
  const [allocationBucket, setAllocationBucket] = useState<AllocationBucket>(
    (allocation?.allocation_bucket ?? "public") as AllocationBucket,
  );
  const [status, setStatus] = useState<Status>(
    (allocation?.status ?? "available") as Status,
  );
  const [stageId, setStageId] = useState<string>(allocation?.stage_id ?? "");
  const [dwellingTypeId, setDwellingTypeId] = useState<string>(
    allocation?.dwelling_type_id ?? "",
  );
  // land_only is derived from dwelling type — empty dropdown means land only.
  // The standalone checkbox was removed (per Uwe 2026-05-21 feedback) because
  // it duplicated and could contradict the dwelling type selection.
  const landOnly = dwellingTypeId === "";
  const [landRateOverride, setLandRateOverride] = useState(
    numToStr(allocation?.land_rate_override_per_sqm ?? null),
  );
  const [houseCost, setHouseCost] = useState(
    numToStr(allocation?.house_cost ?? null),
  );

  function handleDwellingTypeChange(nextId: string) {
    setDwellingTypeId(nextId);
    if (nextId === "") {
      // Switching to land only — house cost no longer applies.
      setHouseCost("");
    }
  }
  const [displayPrice, setDisplayPrice] = useState<boolean>(
    allocation?.display_price_to_public ?? true,
  );
  const [publicLabel, setPublicLabel] = useState(allocation?.public_label ?? "");
  const [internalNotes, setInternalNotes] = useState(
    allocation?.internal_notes ?? "",
  );
  const [wholesale, setWholesale] = useState(
    numToStr(allocation?.wholesale_price ?? null),
  );
  const [retail, setRetail] = useState(numToStr(allocation?.retail_price ?? null));
  const [notes, setNotes] = useState(allocation?.notes ?? "");
  const [reason, setReason] = useState("");

  // FK options
  const [stages, setStages] = useState<StageOption[]>([]);
  const [dwellings, setDwellings] = useState<DwellingOption[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setOptionsLoading(true);
    Promise.all([
      fetch("/api/admin/seafields/stages").then((r) => r.json()),
      fetch("/api/admin/seafields/dwelling-types").then((r) => r.json()),
    ])
      .then(([s, d]) => {
        if (cancelled) return;
        setStages((s.stages ?? []) as StageOption[]);
        setDwellings(
          ((d.dwelling_types ?? []) as DwellingOption[]).filter(
            (x) => x.is_active,
          ),
        );
      })
      .catch(() => {
        if (!cancelled)
          setError("Failed to load stage / dwelling type options");
      })
      .finally(() => {
        if (!cancelled) setOptionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Compute which material fields have changed vs initial allocation
  const materialChanges = useMemo<MaterialKey[]>(() => {
    if (!allocation) return [];
    const changed: MaterialKey[] = [];
    const ws = strToNum(wholesale);
    const rs = strToNum(retail);
    const lro = strToNum(landRateOverride);
    const hc = strToNum(houseCost);
    if ((allocatedTo.trim() || null) !== allocation.allocated_to)
      changed.push("allocated_to");
    if (allocationBucket !== (allocation.allocation_bucket ?? "public"))
      changed.push("allocation_bucket");
    if (status !== (allocation.status ?? "available")) changed.push("status");
    if ((stageId || null) !== (allocation.stage_id ?? null))
      changed.push("stage_id");
    if (lro !== (allocation.land_rate_override_per_sqm ?? null))
      changed.push("land_rate_override_per_sqm");
    if (hc !== (allocation.house_cost ?? null)) changed.push("house_cost");
    if (ws !== (allocation.wholesale_price ?? null))
      changed.push("wholesale_price");
    if (rs !== (allocation.retail_price ?? null))
      changed.push("retail_price");
    if (displayPrice !== (allocation.display_price_to_public ?? true))
      changed.push("display_price_to_public");
    if ((publicLabel.trim() || null) !== (allocation.public_label ?? null))
      changed.push("public_label");
    return changed;
  }, [
    allocation,
    allocatedTo,
    allocationBucket,
    status,
    stageId,
    landRateOverride,
    houseCost,
    wholesale,
    retail,
    displayPrice,
    publicLabel,
  ]);

  const touchesMaterial = materialChanges.length > 0;

  async function handleSave() {
    setError(null);
    if (touchesMaterial && reason.trim().length < 10) {
      setError(
        "A reason (≥10 chars) is required when changing status, allocation, pricing, stage, or public display.",
      );
      return;
    }

    setSaving(true);
    try {
      // Build minimal patch — only fields that differ from the initial
      // allocation. Server's MATERIAL_FIELDS reason gate keys off which
      // material fields are PRESENT in the payload, so we mustn't send
      // unchanged values.
      const a = allocation;
      const stageNumberText = stageId
        ? String(stages.find((s) => s.id === stageId)?.stage_number ?? "")
        : null;
      const trimOrNull = (s: string) => (s.trim() === "" ? null : s.trim());

      const payload: Record<string, unknown> = {};
      if ((allocatedTo.trim() || null) !== (a?.allocated_to ?? null))
        payload.allocated_to = trimOrNull(allocatedTo);
      if (allocationBucket !== (a?.allocation_bucket ?? "public"))
        payload.allocation_bucket = allocationBucket;
      if (status !== (a?.status ?? "available")) payload.status = status;
      if ((stageId || null) !== (a?.stage_id ?? null)) {
        payload.stage_id = stageId || null;
        payload.stage = stageNumberText || null;
      }
      if ((dwellingTypeId || null) !== (a?.dwelling_type_id ?? null)) {
        payload.dwelling_type_id = dwellingTypeId || null;
        // Keep land_only in sync with the dwelling-type selection. Empty
        // dwelling type = land only; any selected type = H&L bundle.
        payload.land_only = landOnly;
      }
      if (strToNum(landRateOverride) !== (a?.land_rate_override_per_sqm ?? null))
        payload.land_rate_override_per_sqm = strToNum(landRateOverride);
      if (strToNum(houseCost) !== (a?.house_cost ?? null))
        payload.house_cost = strToNum(houseCost);
      if (displayPrice !== (a?.display_price_to_public ?? true))
        payload.display_price_to_public = displayPrice;
      if ((publicLabel.trim() || null) !== (a?.public_label ?? null))
        payload.public_label = trimOrNull(publicLabel);
      if ((internalNotes.trim() || null) !== (a?.internal_notes ?? null))
        payload.internal_notes = trimOrNull(internalNotes);
      if (strToNum(wholesale) !== (a?.wholesale_price ?? null))
        payload.wholesale_price = strToNum(wholesale);
      if (strToNum(retail) !== (a?.retail_price ?? null))
        payload.retail_price = strToNum(retail);
      if ((notes.trim() || null) !== (a?.notes ?? null))
        payload.notes = trimOrNull(notes);

      if (Object.keys(payload).length === 0) {
        setError("No changes to save.");
        setSaving(false);
        return;
      }

      if (touchesMaterial) payload.reason = reason.trim();

      const res = await fetch(`/api/admin/seafields/allocations/${lotNumber}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Save failed");
        return;
      }
      onSaved(data.allocation);
      onClose();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function handleClear() {
    const clearReason = window.prompt(
      `Clear allocation for lot ${lotNumber}? Enter reason (≥10 chars):`,
      "Releasing allocation back to public pool",
    );
    if (!clearReason || clearReason.trim().length < 10) {
      if (clearReason !== null) {
        setError("Reason (≥10 chars) is required to clear an allocation.");
      }
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/seafields/allocations/${lotNumber}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allocated_to: null,
          dwelling_type: null,
          allocation_bucket: "public",
          status: "available",
          dwelling_type_id: null,
          reason: clearReason.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Clear failed");
        return;
      }
      onSaved(data.allocation);
      onClose();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  const isHeritage = lotMeta?.isHeritage;
  const publicStatusLabel = STATUS_LABELS[status];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-lot-heading"
      className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-md h-full overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h3 id="edit-lot-heading" className="text-xl font-bold text-slate-900">
              Lot {lotNumber}
            </h3>
            <div className="text-xs text-slate-500 mt-0.5">
              {lotMeta?.area ?? allocation?.sqm}m² · {lotMeta?.zone ?? "—"}
            </div>
            {(allocation?.subdivisible ||
              allocation?.ancillary_dwelling_eligible) && (
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {allocation?.subdivisible && (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200"
                    title="Lot is ≥900m² — eligible for subdivision into 2 lots under WAPC rules."
                  >
                    Subdivisible (≥900m²)
                  </span>
                )}
                {allocation?.ancillary_dwelling_eligible && (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-sky-50 text-sky-800 border border-sky-200"
                    title="R20: ancillary dwelling (capped 70m²) allowed on any lot subject to R-Code build standards. No lot-size threshold."
                  >
                    Ancillary OK
                  </span>
                )}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {isHeritage && (
          <div className="px-6 py-3 bg-amber-50 border-b border-amber-200 text-xs text-amber-900">
            Heritage retention lot — existing building retained, not for sale.
            Allocation status is informational only.
          </div>
        )}

        <div className="px-6 py-4 space-y-5">
          {/* Public-facing read-only block */}
          <div className="bg-slate-50 border border-slate-200 rounded p-3 text-xs text-slate-700">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="uppercase tracking-wider text-slate-500 text-[10px]">
                  Public status
                </div>
                <div className="font-semibold text-slate-900 text-sm mt-0.5">
                  {publicStatusLabel}
                </div>
              </div>
              <div>
                <div className="uppercase tracking-wider text-slate-500 text-[10px]">
                  Public lot size
                </div>
                <div className="font-semibold text-slate-900 text-sm mt-0.5">
                  {lotMeta?.area ?? allocation?.sqm}m²
                </div>
              </div>
            </div>
            <div className="text-[11px] text-slate-500 mt-2">
              Public site shows status + sqm only; offtaker name and pricing
              are hidden unless display_price is on.
            </div>
          </div>

          {/* Allocation */}
          <fieldset className="space-y-3 border-t border-slate-100 pt-4">
            <legend className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Allocation
            </legend>
            <div>
              <label className="block text-xs text-slate-600 mb-1">
                Reservation pool
              </label>
              <select
                value={allocationBucket}
                onChange={(e) =>
                  setAllocationBucket(e.target.value as AllocationBucket)
                }
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
              >
                {ALLOCATION_BUCKETS.map((b) => (
                  <option key={b} value={b}>
                    {BUCKET_LABELS[b]}
                  </option>
                ))}
              </select>
              <div className="text-[11px] text-slate-500 mt-1">
                Pre-set pools (GROH, WACHS, Tarken, Baurimus, F2K withheld,
                Display, Heritage) are self-labelling. Pick &ldquo;Public&rdquo; for any
                open-market or named individual buyer.
              </div>
            </div>
            {allocationBucket === "public" && (
              <div>
                <label className="block text-xs text-slate-600 mb-1">
                  Allocated to (person / company)
                </label>
                <input
                  type="text"
                  value={allocatedTo}
                  onChange={(e) => setAllocatedTo(e.target.value)}
                  placeholder="Optional — buyer name when reserved on the public pool"
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                />
                <div className="text-[11px] text-slate-500 mt-1">
                  Only filled when a specific buyer holds the lot on the public
                  pool. Non-public pools are self-labelling by their name.
                </div>
              </div>
            )}
            <div>
              <label className="block text-xs text-slate-600 mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Status)}
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
          </fieldset>

          {/* Stage & dwelling */}
          <fieldset className="space-y-3 border-t border-slate-100 pt-4">
            <legend className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Stage & dwelling
            </legend>
            <div>
              <label className="block text-xs text-slate-600 mb-1">
                Stage
              </label>
              <select
                value={stageId}
                onChange={(e) => setStageId(e.target.value)}
                disabled={optionsLoading}
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm disabled:opacity-50"
              >
                <option value="">— None —</option>
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    Stage {s.stage_number} — {s.stage_label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">
                Dwelling type
              </label>
              <select
                value={dwellingTypeId}
                onChange={(e) => handleDwellingTypeChange(e.target.value)}
                disabled={optionsLoading}
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm disabled:opacity-50"
              >
                <option value="">Land only (no house)</option>
                {dwellings.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code} — {d.plan_name}
                  </option>
                ))}
              </select>
              <div className="text-[11px] text-slate-500 mt-1">
                Selecting &ldquo;Land only&rdquo; disables the House cost field below; any
                other dwelling type is treated as a H&amp;L bundle. &ldquo;Main Home +
                Ancillary Dwelling&rdquo; is the R20 dual-occupancy product (one house
                plus a ≤70m² ancillary) — allowed on any lot subject to R-Codes,
                not a traditional duplex.
              </div>
            </div>
          </fieldset>

          {/* Land / build */}
          <fieldset className="space-y-3 border-t border-slate-100 pt-4">
            <legend className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Land & build
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-600 mb-1">
                  Land $/m² override
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="1"
                  min="0"
                  value={landRateOverride}
                  onChange={(e) => setLandRateOverride(e.target.value)}
                  placeholder="(stage rate)"
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label
                  className={`block text-xs mb-1 ${
                    landOnly ? "text-slate-400" : "text-slate-600"
                  }`}
                >
                  House cost
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="1000"
                  min="0"
                  value={houseCost}
                  onChange={(e) => setHouseCost(e.target.value)}
                  placeholder={landOnly ? "Land only — N/A" : "0"}
                  disabled={landOnly}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
                />
              </div>
            </div>
          </fieldset>

          {/* Pricing & display */}
          <fieldset className="space-y-3 border-t border-slate-100 pt-4">
            <legend className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Pricing & display
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-600 mb-1">
                  Wholesale (AUD)
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="1000"
                  min="0"
                  value={wholesale}
                  onChange={(e) => setWholesale(e.target.value)}
                  placeholder="0"
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">
                  Retail (AUD)
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="1000"
                  min="0"
                  value={retail}
                  onChange={(e) => setRetail(e.target.value)}
                  placeholder="0"
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={displayPrice}
                onChange={(e) => setDisplayPrice(e.target.checked)}
                className="h-4 w-4"
              />
              <span>Display price to public</span>
            </label>
            <div>
              <label className="block text-xs text-slate-600 mb-1">
                Public label (override)
              </label>
              <input
                type="text"
                value={publicLabel}
                onChange={(e) => setPublicLabel(e.target.value)}
                placeholder="Optional — overrides default lot card title"
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
              />
            </div>
          </fieldset>

          {/* Notes */}
          <fieldset className="space-y-3 border-t border-slate-100 pt-4">
            <legend className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Notes (admin-only)
            </legend>
            <div>
              <label className="block text-xs text-slate-600 mb-1">
                Internal notes
              </label>
              <textarea
                rows={3}
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                placeholder="Workbook-sourced context; carries through V2/V3 merges"
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">
                Notes (legacy)
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Older free-form notes column — superseded by internal_notes"
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
              />
            </div>
          </fieldset>

          {/* Conditional reason gate */}
          {touchesMaterial ? (
            <div className="bg-amber-50 border border-amber-200 rounded p-3">
              <label className="block text-xs font-semibold text-amber-900 uppercase tracking-wider mb-1">
                Reason for change (required, ≥10 chars)
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={`Changing ${materialChanges.join(", ")} — explain why`}
                className="w-full border border-amber-300 rounded px-3 py-2 text-sm bg-white"
              />
              <p className="text-[11px] text-amber-800 mt-1">
                Required because this change affects pricing, status, stage, or
                public display. Audit log records it with your email and
                timestamp.
              </p>
            </div>
          ) : (
            <p className="text-[11px] text-slate-500 italic">
              Cosmetic edit — saves silently. A reason is only required when
              you change status, allocation, pricing, stage, or public display.
            </p>
          )}

          <AdminLotWaitlist
            lotId={lotId}
            lotNumber={lotNumber}
            intentLockedToRegistrationId={
              allocation?.intent_locked_to_registration_id ?? null
            }
            onIntentLockChanged={async () => {
              const res = await fetch("/api/admin/seafields/allocations");
              if (res.ok) {
                const data = await res.json();
                const updated = (data.allocations || []).find(
                  (a: FullAllocation) => a.lot_number === lotNumber,
                );
                if (updated) onSaved(updated);
              }
            }}
            onConvertedToAllocation={async () => {
              const res = await fetch("/api/admin/seafields/allocations");
              if (res.ok) {
                const data = await res.json();
                const updated = (data.allocations || []).find(
                  (a: FullAllocation) => a.lot_number === lotNumber,
                );
                if (updated) {
                  onSaved(updated);
                  onClose();
                }
              }
            }}
          />

          {error && (
            <div className="bg-red-50 border border-red-200 rounded px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-3 flex items-center justify-between gap-3">
          {allocation?.allocated_to ||
          (allocation?.allocation_bucket &&
            allocation.allocation_bucket !== "public") ||
          allocation?.status !== "available" ? (
            <button
              onClick={handleClear}
              disabled={saving}
              className="text-red-600 hover:text-red-800 text-sm font-medium disabled:opacity-50"
            >
              Clear allocation
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 min-h-[44px] rounded text-sm font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-slate-900 hover:bg-slate-700 text-white px-6 py-2.5 min-h-[44px] rounded text-sm font-semibold disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
