import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminUser, hasPermission } from "@/lib/admin-auth";
import { createSupabaseService } from "@/lib/supabase-service";

// Remove a single registrant's interest in ONE Branscombe home. Strips the
// unit from units_selected; if that leaves the registrant interested in no
// homes, the whole registration row is deleted. Clears the unit's soft-lock if
// it pointed at this registrant. Audit-logged. (Answers Uwe's "how do I delete
// an interest?" — there was no such action before.)
const schema = z.object({
  unitId: z.string().regex(/^U\d{1,2}$/, "Invalid unit id"),
});

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const admin = await getAdminUser();
  if (!admin || !hasPermission(admin.role, "manage_branscombe_allocations")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  const registrationId = params.id;
  const { unitId } = parsed.data;
  const unitNumber = Number(unitId.slice(1));
  const service = createSupabaseService();

  const { data: reg, error: regErr } = await (
    service.from("branscombe_registrations") as any
  )
    .select("id, first_name, last_name, units_selected, price_preferences")
    .eq("id", registrationId)
    .maybeSingle();
  if (regErr) {
    return NextResponse.json({ error: regErr.message }, { status: 500 });
  }
  if (!reg) {
    return NextResponse.json({ error: "Registration not found" }, { status: 404 });
  }

  const units: string[] = Array.isArray(reg.units_selected)
    ? reg.units_selected
    : [];
  if (!units.includes(unitId)) {
    return NextResponse.json(
      { error: `That registrant isn't on ${unitId}` },
      { status: 400 },
    );
  }

  const nextUnits = units.filter((u) => u !== unitId);
  const deletedRegistration = nextUnits.length === 0;

  // If this unit was soft-locked to the registrant we're removing, clear it.
  const { data: alloc } = await (
    service.from("branscombe_unit_allocations") as any
  )
    .select("unit_number, intent_locked_to_registration_id")
    .eq("unit_number", unitNumber)
    .maybeSingle();
  if (alloc?.intent_locked_to_registration_id === registrationId) {
    await (service.from("branscombe_unit_allocations") as any)
      .update({
        intent_locked_to_registration_id: null,
        intent_locked_at: null,
        intent_locked_by: null,
      })
      .eq("unit_number", unitNumber);
  }

  if (deletedRegistration) {
    const { error } = await (service.from("branscombe_registrations") as any)
      .delete()
      .eq("id", registrationId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    const prefs =
      reg.price_preferences && typeof reg.price_preferences === "object"
        ? { ...(reg.price_preferences as Record<string, unknown>) }
        : null;
    if (prefs && unitId in prefs) delete prefs[unitId];
    const { error } = await (service.from("branscombe_registrations") as any)
      .update({ units_selected: nextUnits, price_preferences: prefs })
      .eq("id", registrationId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  await service.from("audit_log").insert({
    actor_email: admin.email,
    action: "branscombe_interest_removed",
    entity_type: "branscombe_registration",
    entity_id: registrationId,
    details: {
      unit_id: unitId,
      registrant: `${reg.first_name} ${reg.last_name}`.trim(),
      deleted_registration: deletedRegistration,
    },
  });

  return NextResponse.json({ ok: true, deletedRegistration, unitId });
}
