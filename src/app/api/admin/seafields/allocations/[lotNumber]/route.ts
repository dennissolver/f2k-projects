import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAdminUser, hasPermission, auditLog } from "@/lib/admin-auth";
import {
  createSupabaseService,
  createSupabaseServiceWithActor,
} from "@/lib/supabase-service";
import { sendTemplated } from "@/lib/email/send";
import { guardRecipients } from "@/lib/email/recipient-guard";
import { forwardAllocationToGHL } from "@/lib/ghl";
import { coerceAllocationNumerics } from "@/lib/seafields/coerce-numerics";
import {
  formatCurrency,
  getActiveRecipients,
  renderBrandedEmail,
  escapeHtml as escapeHtmlNotify,
} from "@/lib/seafields/notify";

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

const STATUSES = [
  "available",
  "reserved",
  "withheld",
  "sold",
  "backup_list_only",
] as const;

const CATEGORIES = ["compact", "standard", "large", "premium", "heritage"] as const;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const updateSchema = z.object({
  // Legacy free-text fields (still writable for back-compat; will be retired
  // once consumers fully read from the FK / enum columns instead)
  allocated_to: z.string().trim().max(200).nullable().optional(),
  dwelling_type: z.string().trim().max(50).nullable().optional(),
  stage: z.string().trim().max(50).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),

  // New typed columns from migration 0003
  status: z.enum(STATUSES).nullable().optional(),
  allocation_bucket: z.enum(ALLOCATION_BUCKETS).nullable().optional(),
  stage_id: z.string().regex(UUID_RE).nullable().optional(),
  dwelling_type_id: z.string().regex(UUID_RE).nullable().optional(),
  category: z.enum(CATEGORIES).nullable().optional(),
  zone: z.string().trim().max(200).nullable().optional(),
  land_only: z.boolean().optional(),
  land_rate_override_per_sqm: z
    .number()
    .min(0)
    .max(5_000_000) // land $/m² OR land-total override; $5M sanity cap (was 99,999.99, which blocked real land prices) — per Dennis 2026-05-26
    .nullable()
    .optional(),
  house_cost: z.number().min(0).max(99_999_999.99).nullable().optional(),
  display_price_to_public: z.boolean().optional(),
  public_label: z.string().trim().max(200).nullable().optional(),
  internal_notes: z.string().trim().max(2000).nullable().optional(),

  // Pricing
  wholesale_price: z.number().min(0).max(99_999_999.99).nullable().optional(),
  retail_price: z.number().min(0).max(99_999_999.99).nullable().optional(),

  // Intent-lock workflow
  intent_locked_to_registration_id: z.string().uuid().nullable().optional(),
  x_pct: z.number().min(0).max(100).nullable().optional(),
  y_pct: z.number().min(0).max(100).nullable().optional(),

  // Required by server when ANY MATERIAL_FIELDS field changes.
  reason: z.string().trim().min(10).max(500).optional(),
});

// Per [[seafields-reason-scope]]: reason required only for status, allocation,
// pricing, and stage gating changes. Cosmetic / FK-only / coordinate edits
// save silently.
const MATERIAL_FIELDS = [
  "status",
  "allocated_to",
  "allocation_bucket",
  "stage",
  "stage_id",
  "land_rate_override_per_sqm",
  "house_cost",
  "wholesale_price",
  "retail_price",
  "display_price_to_public",
  "public_label",
] as const;

function emptyToNull<T>(v: T | undefined): T | null | undefined {
  if (v === undefined) return undefined;
  if (typeof v === "string" && v.trim() === "") return null;
  return v;
}

export async function PATCH(
  request: Request,
  { params }: { params: { lotNumber: string } },
) {
  const admin = await getAdminUser();
  if (!admin || !hasPermission(admin.role, "manage_seafields_allocations")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const lotNumber = Number(params.lotNumber);
  if (!Number.isInteger(lotNumber) || lotNumber < 1) {
    return NextResponse.json({ error: "Invalid lot number" }, { status: 400 });
  }

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  const { reason, ...rawUpdates } = parsed.data;

  const updates: Record<string, unknown> = {};
  // Legacy
  if (rawUpdates.allocated_to !== undefined)
    updates.allocated_to = emptyToNull(rawUpdates.allocated_to);
  if (rawUpdates.dwelling_type !== undefined)
    updates.dwelling_type = emptyToNull(rawUpdates.dwelling_type);
  if (rawUpdates.stage !== undefined)
    updates.stage = emptyToNull(rawUpdates.stage);
  if (rawUpdates.notes !== undefined)
    updates.notes = emptyToNull(rawUpdates.notes);
  // New typed
  if (rawUpdates.status !== undefined) updates.status = rawUpdates.status;
  if (rawUpdates.allocation_bucket !== undefined)
    updates.allocation_bucket = rawUpdates.allocation_bucket;
  if (rawUpdates.stage_id !== undefined) updates.stage_id = rawUpdates.stage_id;
  if (rawUpdates.dwelling_type_id !== undefined)
    updates.dwelling_type_id = rawUpdates.dwelling_type_id;
  if (rawUpdates.category !== undefined) updates.category = rawUpdates.category;
  if (rawUpdates.zone !== undefined)
    updates.zone = emptyToNull(rawUpdates.zone);
  if (rawUpdates.land_only !== undefined)
    updates.land_only = rawUpdates.land_only;
  if (rawUpdates.land_rate_override_per_sqm !== undefined)
    updates.land_rate_override_per_sqm = rawUpdates.land_rate_override_per_sqm;
  if (rawUpdates.house_cost !== undefined)
    updates.house_cost = rawUpdates.house_cost;
  if (rawUpdates.display_price_to_public !== undefined)
    updates.display_price_to_public = rawUpdates.display_price_to_public;
  if (rawUpdates.public_label !== undefined)
    updates.public_label = emptyToNull(rawUpdates.public_label);
  if (rawUpdates.internal_notes !== undefined)
    updates.internal_notes = emptyToNull(rawUpdates.internal_notes);
  // Pricing
  if (rawUpdates.wholesale_price !== undefined)
    updates.wholesale_price = rawUpdates.wholesale_price;
  if (rawUpdates.retail_price !== undefined)
    updates.retail_price = rawUpdates.retail_price;
  // Map coords
  if (rawUpdates.x_pct !== undefined) updates.x_pct = rawUpdates.x_pct;
  if (rawUpdates.y_pct !== undefined) updates.y_pct = rawUpdates.y_pct;

  // Intent-lock metadata
  if (rawUpdates.intent_locked_to_registration_id !== undefined) {
    updates.intent_locked_to_registration_id =
      rawUpdates.intent_locked_to_registration_id;
    if (rawUpdates.intent_locked_to_registration_id) {
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

  // Material-field reason gate
  const touchesMaterial = MATERIAL_FIELDS.some((f) => f in updates);
  if (touchesMaterial && (!reason || reason.length < 10)) {
    return NextResponse.json(
      {
        error:
          "A reason (≥10 chars) is required when changing status, allocation, pricing, stage gating, or public display.",
      },
      { status: 400 },
    );
  }

  // Stamp assignment metadata when allocated_to is changing
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

  // Keep the legacy free-text `dwelling_type` column in sync with the FK
  // (`dwelling_type_id`). The admin lots list reads `dwelling_type` for its
  // Type column, filter, sort and search, but the edit modal only writes
  // `dwelling_type_id` — so a dwelling-type change never showed in the list,
  // and an FK-cleared (land-only) lot kept a stale "2x2BR" text (Uwe
  // 2026-06-14). When the caller already sets `dwelling_type` explicitly
  // (e.g. the Clear-allocation path sends both as null) we leave it alone.
  if ("dwelling_type_id" in updates && !("dwelling_type" in updates)) {
    const fkId = updates.dwelling_type_id as string | null;
    if (!fkId) {
      updates.dwelling_type = null;
    } else {
      const { data: dt } = await (supabase.from("dwelling_types") as any)
        .select("code")
        .eq("id", fkId)
        .maybeSingle();
      updates.dwelling_type = (dt?.code as string | null) ?? null;
    }
  }

  const { data: priorRow } = await (
    supabase.from("seafields_lot_allocations") as any
  )
    .select(
      "intent_locked_to_registration_id, allocated_to, status, allocation_bucket, stage, wholesale_price, retail_price, house_cost, land_rate_override_per_sqm, display_price_to_public, public_label",
    )
    .eq("lot_number", lotNumber)
    .maybeSingle();
  const priorStatus: string | null = priorRow?.status ?? null;

  // F2KSFLDS-25: a firm allocation locks the lot from the public market.
  // When a lot is allocated to a named buyer (`allocated_to` set) and the
  // admin didn't explicitly choose a status, auto-flip an Available lot to
  // Reserved so it can no longer be registered-for or double-allocated.
  // Public registrations of interest stay multi-interest (heat map intact) —
  // the lock lives on the admin allocation action, per product decision
  // 2026-06-06. Allocation-derived reserves do NOT fan out the registrant
  // "reserved" emails below (matches prior allocation behaviour and avoids an
  // email blast during bulk reconciliation); an explicit status change still
  // notifies as before.
  const statusExplicitlyChanged = rawUpdates.status !== undefined;
  let autoReservedFromAllocation = false;
  if (
    !statusExplicitlyChanged &&
    "allocated_to" in updates &&
    updates.allocated_to &&
    priorStatus === "available"
  ) {
    updates.status = "reserved";
    autoReservedFromAllocation = true;
  }

  // Attributed write — audit trigger (migration 0008) records actor_email
  // and reason on every per-field row.
  const attributed = createSupabaseServiceWithActor(admin.email, reason ?? null);
  const { data: updated, error } = await (attributed
    .from("seafields_lot_allocations") as any)
    .update(updates)
    .eq("lot_number", lotNumber)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Forward allocation state to GHL if a registrant is identifiable.
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
        supabase.from("seafields_registrations") as any
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
            itemId: `L${lotNumber}`,
            itemNumber: lotNumber,
            state,
            allocatedTo: (updates.allocated_to as string | null) ?? null,
            notes: (updates.notes as string | null) ?? null,
          },
          "seafields",
        );
        if (!result.error && !result.skipped) {
          await auditLog(
            admin.id,
            admin.email,
            "ghl_allocation_forwarded",
            "seafields_lot_allocation",
            null,
            {
              lot_number: lotNumber,
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

  // F2KSFLDS-9: lot-status transition email fan-out. Best-effort — never
  // blocks the admin response. Status changes from available→reserved
  // notify every registrant on the lot (primary + backup_list); changes
  // from reserved→available notify backup_list only with their queue
  // position so they know they can convert.
  try {
    const newStatus = (updates.status as string | undefined) ?? null;
    if (newStatus && newStatus !== priorStatus && !autoReservedFromAllocation) {
      const fromAvailable = priorStatus === "available";
      const fromReserved = priorStatus === "reserved";
      const toReserved = newStatus === "reserved";
      const toAvailable = newStatus === "available";

      if (fromAvailable && toReserved) {
        // Fan out lot_reserved_notice to every registrant on this lot.
        const { data: rows } = await (
          supabase.from("seafields_registration_lots") as any
        )
          .select(
            "registration_type, seafields_registrations!inner(first_name, email)",
          )
          .eq("lot_number", lotNumber)
          .eq("status", "active");

        for (const row of (rows as Array<{
          registration_type: string;
          seafields_registrations: { first_name: string; email: string };
        }> | null) ?? []) {
          const isBackup = row.registration_type === "backup_list";
          const msg = isBackup
            ? "You are on the backup list for this lot — if it becomes available again, we will notify you in queue order."
            : "If your interest was as a primary registrant, please reach out so we can help you explore alternative lots in the same release.";
          await sendTemplated({
            slug: "lot_reserved_notice",
            to: row.seafields_registrations.email,
            variables: {
              first_name: row.seafields_registrations.first_name,
              lot_number: lotNumber,
              registration_type_message: msg,
            },
            audit: {
              actorEmail: admin.email,
              entityType: "seafields_lot_allocation",
              entityId: null,
            },
          });
        }
        await auditLog(
          admin.id,
          admin.email,
          "lot_reserved_notifications_sent",
          "seafields_lot_allocation",
          null,
          { lot_number: lotNumber, count: (rows ?? []).length },
        );
      } else if (fromReserved && toAvailable) {
        // Notify backup_list with their current queue position.
        const { data: rows } = await (
          supabase.from("seafields_registration_lots") as any
        )
          .select(
            "position_in_queue, seafields_registrations!inner(first_name, email)",
          )
          .eq("lot_number", lotNumber)
          .eq("status", "active")
          .eq("registration_type", "backup_list")
          .order("position_in_queue", { ascending: true });

        for (const row of (rows as Array<{
          position_in_queue: number | null;
          seafields_registrations: { first_name: string; email: string };
        }> | null) ?? []) {
          await sendTemplated({
            slug: "lot_released_notice",
            to: row.seafields_registrations.email,
            variables: {
              first_name: row.seafields_registrations.first_name,
              lot_number: lotNumber,
              position_in_queue: row.position_in_queue ?? 1,
            },
            audit: {
              actorEmail: admin.email,
              entityType: "seafields_lot_allocation",
              entityId: null,
            },
          });
        }
        await auditLog(
          admin.id,
          admin.email,
          "lot_released_notifications_sent",
          "seafields_lot_allocation",
          null,
          { lot_number: lotNumber, count: (rows ?? []).length },
        );
      }
    }
  } catch (err) {
    console.error("Seafields lot-status email fan-out threw:", err);
  }

  // Admin-team notification on material lot changes. Best-effort — never
  // blocks the save. Bundles every changed field into ONE email per save so
  // a single click of "Save" doesn't trigger five separate emails.
  try {
    type Change = { label: string; before: string; after: string };
    const changes: Change[] = [];

    function fmt(v: unknown, kind: "text" | "currency" | "bool"): string {
      if (v == null || v === "") return "—";
      if (kind === "currency" && typeof v === "number")
        return formatCurrency(v);
      if (kind === "bool") return v ? "Yes" : "No";
      return String(v);
    }
    function diff(
      key: keyof typeof updates,
      label: string,
      kind: "text" | "currency" | "bool" = "text",
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

    diff("status", "Status");
    diff("allocated_to", "Allocated to");
    diff("allocation_bucket", "Bucket");
    diff("stage", "Stage");
    diff("wholesale_price", "Wholesale price", "currency");
    diff("retail_price", "Retail price", "currency");
    diff("house_cost", "House cost", "currency");
    diff("land_rate_override_per_sqm", "Land rate override $/m²", "currency");
    diff("display_price_to_public", "Show price publicly", "bool");
    diff("public_label", "Public label");

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
        value: `<span style="color:#94A3B8">${escapeHtmlNotify(c.before)}</span> &rarr; <strong style="color:#0F172A">${escapeHtmlNotify(c.after)}</strong>`,
      }));
      rows.push({
        label: "Changed by",
        value: escapeHtmlNotify(admin.email),
      });
      if (reason) {
        rows.push({ label: "Reason", value: escapeHtmlNotify(reason) });
      }
      const html = renderBrandedEmail({
        preheader: `Lot ${lotNumber} ${verb} (${admin.email})`,
        heading: `Lot ${lotNumber} — ${verb}`,
        intro: `Admin update saved by <strong>${escapeHtmlNotify(admin.email)}</strong>${reason ? ` with reason: <em>${escapeHtmlNotify(reason)}</em>` : ""}.`,
        rows,
        ctaLabel: "Open lot in admin",
        ctaHref: `https://f2k-projects.vercel.app/admin/seafields-lots`,
        footer:
          "Sent because you are on the Seafields admin-notification list. Manage at /admin/seafields-registrations.",
      });
      const guard = guardRecipients(recipients, { triggeredByEmail: admin.email });
      const { error: sendErr } = await resend.emails.send({
        from:
          process.env.RESEND_FROM_EMAIL ||
          "Seafields Estate <onboarding@resend.dev>",
        to: guard.to,
        subject: `Lot ${lotNumber} ${verb} (by ${admin.email})`,
        html,
      });
      if (sendErr) console.error("seafields admin lot-change notification: Resend send error:", sendErr);
    }
  } catch (err) {
    console.error("Seafields admin lot-change notify failed:", err);
  }

  // Bust the static cache so the public Seafields page picks up the change
  // on the next request — without this, admin edits don't appear on the site
  // until the next ISR window (Uwe 2026-05-21 feedback).
  revalidatePath("/seafields-estate");
  revalidatePath("/");

  // Coerce NUMERIC-as-string back to numbers so the row merged into the admin
  // table matches the client's number|null contract (avoids re-introducing the
  // phantom "price changed" on the next edit).
  return NextResponse.json({
    allocation: coerceAllocationNumerics(updated as Record<string, unknown>),
  });
}
