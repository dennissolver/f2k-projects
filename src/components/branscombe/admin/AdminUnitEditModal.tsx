"use client";

import { useEffect, useState } from "react";
import { UNIT_BY_ID, HOUSE_TYPE_INFO } from "@/data/branscombe";
import AdminUnitWaitlist from "./AdminUnitWaitlist";

export interface FullAllocation {
  unit_number: number;
  home_type: string;
  area_m2: number;
  allocated_to: string | null;
  dwelling_type: string | null;
  notes: string | null;
  wholesale_price: number | null;
  retail_price: number | null;
  intent_locked_to_registration_id: string | null;
  intent_locked_at: string | null;
  assigned_at: string | null;
  updated_at: string;
}

interface Props {
  unitNumber: number;
  unitId: string;
  allocation: FullAllocation | null;
  onClose: () => void;
  onSaved: (a: FullAllocation) => void;
}

const DWELLING_OPTIONS = ["", "3BR / 2BA"];

export default function AdminUnitEditModal({
  unitNumber,
  unitId,
  allocation,
  onClose,
  onSaved,
}: Props) {
  const unit = UNIT_BY_ID[unitId];
  const typeInfo = unit ? HOUSE_TYPE_INFO[unit.type] : null;

  const [allocatedTo, setAllocatedTo] = useState(allocation?.allocated_to ?? "");
  const [dwellingType, setDwellingType] = useState(
    allocation?.dwelling_type ?? "",
  );
  const [wholesale, setWholesale] = useState<string>(
    allocation?.wholesale_price != null
      ? String(allocation.wholesale_price)
      : "",
  );
  const [retail, setRetail] = useState<string>(
    allocation?.retail_price != null ? String(allocation.retail_price) : "",
  );
  const [notes, setNotes] = useState(allocation?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      const wholesaleNum = wholesale.trim() === "" ? null : Number(wholesale);
      const retailNum = retail.trim() === "" ? null : Number(retail);
      if (wholesaleNum !== null && Number.isNaN(wholesaleNum)) {
        setError("Wholesale price must be a number");
        setSaving(false);
        return;
      }
      if (retailNum !== null && Number.isNaN(retailNum)) {
        setError("Retail price must be a number");
        setSaving(false);
        return;
      }
      const res = await fetch(`/api/admin/branscombe/allocations/${unitNumber}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allocated_to: allocatedTo.trim() || null,
          dwelling_type: dwellingType.trim() || null,
          notes: notes.trim() || null,
          wholesale_price: wholesaleNum,
          retail_price: retailNum,
        }),
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
    if (
      !confirm(
        `Clear allocation for ${unitId}? This removes the buyer/tenant but keeps notes.`,
      )
    )
      return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/branscombe/allocations/${unitNumber}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allocated_to: null,
          dwelling_type: null,
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

  const publicStatus = allocation?.allocated_to
    ? "Reserved"
    : allocation?.intent_locked_to_registration_id
      ? "Reserved (under discussion)"
      : "Available";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-unit-heading"
      className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/20"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-md h-full overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h3
              id="edit-unit-heading"
              className="text-xl font-bold text-slate-900"
            >
              {unitId} — Type {unit?.type ?? "?"}
            </h3>
            <div className="text-xs text-slate-500 mt-0.5">
              {typeInfo
                ? `${typeInfo.size} home + ${typeInfo.deck} · ${typeInfo.beds} bed / ${typeInfo.baths} bath`
                : "—"}
              {" · "}
              {unit?.zone}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-4 space-y-5">
          {/* Public-facing read-only block */}
          <div className="bg-slate-50 border border-slate-200 rounded p-3 text-xs text-slate-700">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="uppercase tracking-wider text-slate-500 text-[10px]">
                  Public status
                </div>
                <div className="font-semibold text-slate-900 text-sm mt-0.5">
                  {publicStatus}
                </div>
              </div>
              <div>
                <div className="uppercase tracking-wider text-slate-500 text-[10px]">
                  Home + deck
                </div>
                <div className="font-semibold text-slate-900 text-sm mt-0.5">
                  {typeInfo?.size}
                  {" + "}
                  {typeInfo?.deck}
                </div>
              </div>
            </div>
            <div className="text-[11px] text-slate-500 mt-2">
              Public site shows status only; buyer name and pricing are hidden.
            </div>
          </div>

          {/* Editable fields */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Allocated to (buyer / tenant)
            </label>
            <input
              type="text"
              value={allocatedTo}
              onChange={(e) => setAllocatedTo(e.target.value)}
              placeholder="e.g. Smith Family, Housing Choices Tas, investor name"
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
            />
            <div className="text-[11px] text-slate-500 mt-1">
              Setting any value flips the home to Reserved on the public site.
              Leave blank to keep Available.
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Dwelling overlay (optional)
            </label>
            <select
              value={dwellingType}
              onChange={(e) => setDwellingType(e.target.value)}
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
            >
              {DWELLING_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt || "— None —"}
                </option>
              ))}
            </select>
            <div className="text-[11px] text-slate-500 mt-1">
              Home type ({unit?.type}) is fixed by the architectural set;
              this is a free-text overlay for admin notes.
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
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
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
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

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Notes (admin-only)
            </label>
            <textarea
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. buyer in finance approval; deposit pending; subject to subdivision DA"
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
            />
          </div>

          <AdminUnitWaitlist
            unitId={unitId}
            unitNumber={unitNumber}
            intentLockedToRegistrationId={
              allocation?.intent_locked_to_registration_id ?? null
            }
            onIntentLockChanged={async () => {
              const res = await fetch("/api/admin/branscombe/allocations");
              if (res.ok) {
                const data = await res.json();
                const updated = (data.allocations || []).find(
                  (a: FullAllocation) => a.unit_number === unitNumber,
                );
                if (updated) onSaved(updated);
              }
            }}
            onConvertedToAllocation={async () => {
              const res = await fetch("/api/admin/branscombe/allocations");
              if (res.ok) {
                const data = await res.json();
                const updated = (data.allocations || []).find(
                  (a: FullAllocation) => a.unit_number === unitNumber,
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
          {allocation?.allocated_to ? (
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
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-slate-900 hover:opacity-90 text-white px-5 py-2 rounded text-sm font-semibold disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
