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

export async function GET() {
  const admin = await getAdminUser();
  if (!admin || !hasPermission(admin.role, "view_registrations")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createSupabaseService();

  // Pull join rows with full contact context. Sort by lot then position
  // so primary registrants render above backup_list within each lot.
  const { data, error } = await (supabase
    .from("seafields_registration_lots") as any)
    .select(
      "id, lot_number, registration_type, status, position_in_queue, created_at, " +
        "stage_at_registration_id, " +
        "stages(stage_number, stage_label), " +
        "seafields_registrations!inner(id, agent_id, first_name, last_name, email, phone, suburb, postcode, buyer_type, purchase_timeline, finance_status, interest_type, created_at)",
    )
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

  return NextResponse.json({ registrations: rows });
}
