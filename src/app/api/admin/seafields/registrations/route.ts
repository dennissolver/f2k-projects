import { NextResponse } from "next/server";
import { getAdminUser, hasPermission } from "@/lib/admin-auth";
import { createSupabaseService } from "@/lib/supabase-service";

export const dynamic = "force-dynamic";

export type RegistrationJoinRow = {
  joinId: string;
  lot_number: number;
  stage_number: number | null;
  stage_label: string | null;
  registration_type: "primary" | "backup_list";
  status: "active" | "locked_in" | "released" | "converted_to_sale" | "cancelled";
  position_in_queue: number | null;
  created_at: string;
  registration: {
    id: string;
    agent_id: string | null;
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    suburb: string | null;
    postcode: string | null;
    buyer_type: string | null;
    purchase_timeline: string | null;
    finance_status: string | null;
    interest_type: string | null;
    created_at: string;
  };
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get("agent_id");

  const admin = await getAdminUser();
  if (!admin || !hasPermission(admin.role, "view_registrations")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createSupabaseService();

  let query: any = supabase
    .from("seafields_registration_lots")
    .select(
      "id, lot_number, registration_type, status, position_in_queue, created_at, " +
        "stage_at_registration_id, " +
        "stages(stage_number, stage_label), " +
        "seafields_registrations!inner(id, agent_id, first_name, last_name, email, phone, suburb, postcode, buyer_type, purchase_timeline, finance_status, interest_type, created_at)",
    );

  if (agentId) {
    query = query.eq("seafields_registrations.agent_id", agentId);
  }

  const { data, error } = await query
    .order("lot_number", { ascending: true })
    .order("registration_type", { ascending: true })
    .order("position_in_queue", { ascending: true, nullsFirst: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type Raw = {
    id: string;
    lot_number: number;
    registration_type: RegistrationJoinRow["registration_type"];
    status: RegistrationJoinRow["status"];
    position_in_queue: number | null;
    created_at: string;
    stages: { stage_number: number; stage_label: string } | null;
    seafields_registrations: RegistrationJoinRow["registration"];
  };

  const rows: RegistrationJoinRow[] = ((data as Raw[]) || []).map((r) => ({
    joinId: r.id,
    lot_number: r.lot_number,
    stage_number: r.stages?.stage_number ?? null,
    stage_label: r.stages?.stage_label ?? null,
    registration_type: r.registration_type,
    status: r.status,
    position_in_queue: r.position_in_queue,
    created_at: r.created_at,
    registration: r.seafields_registrations,
  }));

  const formatted = rows.map((r) => ({
    id: r.registration.id,
    client_name: `${r.registration.first_name} ${r.registration.last_name}`.trim(),
    client_email: r.registration.email,
    client_phone: r.registration.phone,
    lot_number: `L${r.lot_number}`,
    stage: r.stage_label,
    dwelling_type: r.registration.interest_type,
    status: r.status,
    created_at: r.created_at,
    estate: "seafields",
  }));

  return NextResponse.json({ registrations: formatted });
}
