import { NextResponse } from "next/server";
import { getAdminUser, hasPermission } from "@/lib/admin-auth";
import { createSupabaseService } from "@/lib/supabase-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get("agent_id");

  const admin = await getAdminUser();
  if (!admin || !hasPermission(admin.role, "view_registrations")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createSupabaseService();

  let query = supabase
    .from("branscombe_registrations")
    .select("*")
    .order("created_at", { ascending: false });

  if (agentId) {
    query = query.eq("agent_id", agentId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const registrations = (data || []).map((r: any) => ({
    id: r.id,
    client_name: `${r.first_name} ${r.last_name}`.trim(),
    client_email: r.email,
    client_phone: r.phone,
    unit_number: r.units_selected?.[0] || null,
    dwelling_type: r.unit_type_preference || null,
    status: "active",
    created_at: r.created_at,
    estate: "branscombe",
  }));

  return NextResponse.json({ registrations });
}
