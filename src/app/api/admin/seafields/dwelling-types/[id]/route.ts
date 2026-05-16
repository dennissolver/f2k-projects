import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminUser, hasPermission, auditLog } from "@/lib/admin-auth";
import { createSupabaseService } from "@/lib/supabase-service";

const updateSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1)
    .max(50)
    .regex(/^[A-Za-z0-9_-]+$/, "code must be alphanumeric / _ / -")
    .optional(),
  plan_name: z.string().trim().min(1).max(200).optional(),
  bedrooms: z.number().int().min(0).max(20).nullable().optional(),
  bathrooms: z.number().int().min(0).max(20).nullable().optional(),
  floor_area_sqm: z.number().min(0).max(9999.99).nullable().optional(),
  build_cost_default: z.number().min(0).max(99_999_999.99).nullable().optional(),
  display_label: z.string().trim().max(200).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  is_active: z.boolean().optional(),
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const admin = await getAdminUser();
  if (!admin || !hasPermission(admin.role, "manage_seafields_dwelling_types")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!UUID_RE.test(params.id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  // Strip undefined so we only patch fields the client actually sent.
  const updates: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v !== undefined) updates[k] = v;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const supabase = createSupabaseService();
  const { data, error } = await (supabase.from("dwelling_types") as any)
    .update(updates)
    .eq("id", params.id)
    .select(
      "id, code, plan_name, bedrooms, bathrooms, floor_area_sqm, build_cost_default, display_label, notes, is_active, created_at, updated_at",
    )
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: `Dwelling type code "${updates.code}" already exists` },
        { status: 409 },
      );
    }
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await auditLog(
    admin.id,
    admin.email,
    "dwelling_type_updated",
    "dwelling_type",
    params.id,
    { code: data.code, patch: updates },
  );

  return NextResponse.json({ dwelling_type: data });
}
