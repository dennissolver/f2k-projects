import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminUser, hasPermission, auditLog } from "@/lib/admin-auth";
import { createSupabaseService } from "@/lib/supabase-service";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1)
    .max(50)
    .regex(/^[A-Za-z0-9_-]+$/, "code must be alphanumeric / _ / -"),
  plan_name: z.string().trim().min(1).max(200),
  bedrooms: z.number().int().min(0).max(20).nullable().optional(),
  bathrooms: z.number().int().min(0).max(20).nullable().optional(),
  floor_area_sqm: z.number().min(0).max(9999.99).nullable().optional(),
  build_cost_default: z.number().min(0).max(99_999_999.99).nullable().optional(),
  display_label: z.string().trim().max(200).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  is_active: z.boolean().optional(),
});

export async function GET() {
  const admin = await getAdminUser();
  if (!admin || !hasPermission(admin.role, "manage_seafields_dwelling_types")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createSupabaseService();
  const { data, error } = await (supabase.from("dwelling_types") as any)
    .select(
      "id, code, plan_name, bedrooms, bathrooms, floor_area_sqm, build_cost_default, display_label, notes, is_active, created_at, updated_at",
    )
    .order("code");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ dwelling_types: data ?? [] });
}

export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (!admin || !hasPermission(admin.role, "manage_seafields_dwelling_types")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  const supabase = createSupabaseService();
  const { data, error } = await (supabase.from("dwelling_types") as any)
    .insert(parsed.data)
    .select(
      "id, code, plan_name, bedrooms, bathrooms, floor_area_sqm, build_cost_default, display_label, notes, is_active, created_at, updated_at",
    )
    .single();

  if (error) {
    // 23505 = unique violation
    if (error.code === "23505") {
      return NextResponse.json(
        { error: `Dwelling type code "${parsed.data.code}" already exists` },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await auditLog(
    admin.id,
    admin.email,
    "dwelling_type_created",
    "dwelling_type",
    data.id,
    { code: data.code, plan_name: data.plan_name },
  );

  return NextResponse.json({ dwelling_type: data }, { status: 201 });
}
