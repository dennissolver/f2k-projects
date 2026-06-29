import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminUser, hasPermission, auditLog } from "@/lib/admin-auth";
import { createSupabaseService } from "@/lib/supabase-service";
import { forwardAllocationToGHL } from "@/lib/ghl";
import { guardRecipients } from "@/lib/email/recipient-guard";
import {
  escapeHtml,
  formatCurrency,
  getActiveRecipients,
  renderBrandedEmail,
} from "@/lib/branscombe/notify";

const updateSchema = z.object({
  allocated_to: z.string().trim().max(200).nullable().optional(),
  dwelling_type: z.string().trim().max(50).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  wholesale_price: z.number().min(0).max(99_999_999.99).nullable().optional(),
  retail_price: z.number().min(0).max(99_999_999.99).nullable().optional(),
  /**
   * Soft-allocation: pin a specific branscombe_registrations entry as the
   * priority lead for this unit. Pass null to clear the lock.
   */
  intent_locked_to_registration_id: z.string().uuid().nullable().optional(),
});

function emptyToNull<T>(v: T | undefined): T | null | undefined {
  if (v === undefined) return undefined;
  if (typeof v === "string" && v.trim() === "") return null;
  return v;
}

export async function PATCH(
  request: Request,
  { params }: { params: { unitNumber: string } },
) {
  const admin = await getAdminUser();
  if (!admin || !hasPermission(admin.role, "manage_branscombe_allocations")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const unitNumber = Number(params.unitNumber);
  if (!Number.isInteger(unitNumber) || unitNumber < 1 || unitNumber > 37) {
    return NextResponse.json({ error: "Invalid unit number" }, { status: 400 });
  }

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.allocated_to !== undefined)
    updates.allocated_to = emptyToNull(parsed.data.allocated_to);
  if (parsed.data.dwelling_type !== undefined)
    updates.dwelling_type = emptyToNull(parsed.data.dwelling_type);
  if (parsed.data.notes !== undefined)
    updates.notes = emptyToNull(parsed.data.notes);
  if (parsed.data.wholesale_price !== undefined)
    updates.wholesale_price = parsed.data.wholesale_price;
  if (parsed.data.retail_price !== undefined)
    updates.retail_price = parsed.data.retail_price;

  if (parsed.data.intent_locked_to_registration_id !== undefined) {
    updates.intent_locked_to_registration_id =
      parsed.data.intent_locked_to_registration_id;
    if (parsed.data.intent_locked_to_registration_id) {
      updates.intent_locked_at = new Date().toISOString();
      updates.intent_locked_by = admin.auth_user_id;
    } else {
      updates.intent_locked_at = null;
      updates.intent_locked_by = null;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  if ("allocated_to" in updates) {
    updates.assigned_by = admin.auth_user_id;
    updates.assigned_at = new Date().toISOString();
    // Firm allocation supersedes any soft intent-lock — clear atomically.
    if (updates.allocated_to) {
      updates.intent_locked_to_registration_id = null;
      updates.intent_locked_at = null;
      updates.intent_locked_by = null;
    }
  }

  const supabase = createSupabaseService();

  // Read the row BEFORE the update so we can look up the registrant via the
  // soft-allocate FK that gets atomically cleared on firm allocation, AND
  // so we can diff the changed material fields for the admin-team email.
  const { data: priorRow } = await (
    supabase.from("branscombe_unit_allocations") as any
  )
    .select(
      "intent_locked_to_registration_id, allocated_to, dwelling_type, wholesale_price, retail_price",
    )
    .eq("unit_number", unitNumber)
    .maybeSingle();

  const { data: updated, error } = await (
    supabase.from("branscombe_unit_allocations") as any
  )
    .update(updates)
    .eq("unit_number", unitNumber)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await auditLog(
    admin.id,
    admin.email,
    "branscombe_unit_allocation_updated",
    "branscombe_unit_allocation",
    null,
    { unit_number: unitNumber, ...updates },
  );

  // Forward allocation state to GHL if a registrant is identifiable.
  // - Soft-allocate (intent_locked set) → look up the new FK
  // - Firm-allocate (allocated_to set) → look up the prior FK (just cleared)
  // - Cleared (allocated_to nulled) → use prior FK if any
  // No-op if no FK is available (e.g. WACHS bulk allocations are
  // institutional, not individual GHL contacts).
  try {
    let regId: string | null = null;
    let state: "soft" | "firm" | "cleared" | null = null;
    if (
      "intent_locked_to_registration_id" in updates &&
      updates.intent_locked_to_registration_id
    ) {
      regId = updates.intent_locked_to_registration_id as string;
      state = "soft";
    } else if ("allocated_to" in updates) {
      regId =
        (priorRow?.intent_locked_to_registration_id as string | null) ?? null;
      state = updates.allocated_to ? "firm" : "cleared";
    }

    if (regId && state) {
      const { data: reg } = await (
        supabase.from("branscombe_registrations") as any
      )
        .select("first_name, last_name, email, phone")
        .eq("id", regId)
        .maybeSingle();

      if (reg?.email) {
        const result = await forwardAllocationToGHL(
          {
            email: reg.email,
            firstName: reg.first_name,
            lastName: reg.last_name,
            phone: reg.phone,
            itemId: `U${unitNumber}`,
            itemNumber: unitNumber,
            state,
            allocatedTo: (updates.allocated_to as string | null) ?? null,
            notes: (updates.notes as string | null) ?? null,
          },
          "branscombe",
        );
        if (!result.error && !result.skipped) {
          await auditLog(
            admin.id,
            admin.email,
            "ghl_allocation_forwarded",
            "branscombe_unit_allocation",
            null,
            {
              unit_number: unitNumber,
              state,
              contact_id: result.contactId,
              email: reg.email,
            },
          );
        } else if (result.error) {
          console.error("GHL allocation forward failed:", result.error);
        }
      }
    }
  } catch (err) {
    console.error("GHL allocation forward threw:", err);
  }

  // Admin-team notification on material unit changes. Best-effort —
  // never blocks the save. Bundles every changed field into ONE email
  // per save so one click of "Save" doesn't trigger four emails.
  try {
    type Change = { label: string; before: string; after: string };
    const changes: Change[] = [];

    function fmt(v: unknown, kind: "text" | "currency"): string {
      if (v == null || v === "") return "—";
      if (kind === "currency" && typeof v === "number")
        return formatCurrency(v);
      return String(v);
    }
    function diff(
      key: keyof typeof updates,
      label: string,
      kind: "text" | "currency" = "text",
    ) {
      if (!(key in updates)) return;
      const before = (priorRow as Record<string, unknown> | null)?.[key];
      const after = (updates as Record<string, unknown>)[key];
      if (before === after) return;
      if (before == null && (after == null || after === "")) return;
      changes.push({
        label,
        before: fmt(before, kind),
        after: fmt(after, kind),
      });
    }

    diff("allocated_to", "Allocated to");
    diff("dwelling_type", "Dwelling type");
    diff("wholesale_price", "Wholesale price", "currency");
    diff("retail_price", "Retail price", "currency");

    if (changes.length > 0) {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      const recipients = await getActiveRecipients();
      const verb =
        changes.length === 1
          ? `${changes[0].label.toLowerCase()} changed`
          : `${changes.length} fields changed`;
      const rows = changes.map((c) => ({
        label: c.label,
        value: `<span style="color:#94A3B8">${escapeHtml(c.before)}</span> &rarr; <strong style="color:#0F172A">${escapeHtml(c.after)}</strong>`,
      }));
      rows.push({
        label: "Changed by",
        value: escapeHtml(admin.email),
      });
      const html = renderBrandedEmail({
        preheader: `U${unitNumber} ${verb} (${admin.email})`,
        heading: `U${unitNumber} — ${verb}`,
        intro: `Admin update saved by <strong>${escapeHtml(admin.email)}</strong>.`,
        rows,
        ctaLabel: "Open unit in admin",
        ctaHref: `https://f2k-projects.vercel.app/admin/branscombe-units`,
        footer:
          "Sent because you are on the Branscombe admin-notification list. Manage at /admin/branscombe-pipeline.",
      });
      const guard = guardRecipients(recipients, { triggeredByEmail: admin.email });
      const { error: sendErr } = await resend.emails.send({
        from:
          process.env.RESEND_FROM_EMAIL ||
          "Branscombe Estate <onboarding@resend.dev>",
        to: guard.to,
        subject: `U${unitNumber} ${verb} (by ${admin.email})`,
        html,
      });
      if (sendErr) console.error("branscombe admin unit-change notification: Resend send error:", sendErr);
    }
  } catch (err) {
    console.error("Branscombe admin unit-change notify failed:", err);
  }

  return NextResponse.json({ allocation: updated });
}
