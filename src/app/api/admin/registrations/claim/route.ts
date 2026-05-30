import { NextResponse } from "next/server";
import { createSupabaseService } from "@/lib/supabase-service";
import { getAdminUser, auditLog } from "@/lib/admin-auth";

export async function POST(request: Request) {
  const adminUser = await getAdminUser();
  if (!adminUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { registration_id, project, agent_id, action } = await request.json();

  if (!registration_id || !project || !action) {
    return NextResponse.json(
      { error: "Missing required fields: registration_id, project, action" },
      { status: 400 }
    );
  }

  if (action === "claim" && !agent_id) {
    return NextResponse.json(
      { error: "agent_id required for claim action" },
      { status: 400 }
    );
  }

  const supabase = createSupabaseService();

  const tableName =
    project === "seafields"
      ? "seafields_registrations"
      : project === "branscombe"
        ? "branscombe_registrations"
        : null;

  if (!tableName) {
    return NextResponse.json({ error: "Invalid project" }, { status: 400 });
  }

  const { data: current, error: fetchError } = await supabase
    .from(tableName)
    .select("id, ownership, agent_id, first_name, last_name, email")
    .eq("id", registration_id)
    .single();

  if (fetchError || !current) {
    return NextResponse.json(
      { error: "Registration not found" },
      { status: 404 }
    );
  }

  let newOwnership: "agent" | "house" | "unassigned" = "agent";
  let updateData: Record<string, unknown> = {
    agent_id: action === "claim" ? agent_id : null,
  };

  if (action === "claim") {
    newOwnership = "agent";
    updateData.ownership = "agent";
  } else if (action === "release") {
    newOwnership = "house";
    updateData.ownership = "house";
    updateData.agent_id = null;
  }

  const { error: updateError } = await supabase
    .from(tableName)
    .update(updateData)
    .eq("id", registration_id);

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message },
      { status: 500 }
    );
  }

  const notificationType =
    action === "claim" ? "registration_claimed" : "registration_reassigned";

  await supabase.from("admin_notifications").insert({
    type: notificationType,
    title:
      action === "claim"
        ? "Registration Claimed"
        : "Registration Released",
    message:
      action === "claim"
        ? `${adminUser.full_name || adminUser.email} claimed ${current.first_name} ${current.last_name} (${current.email})`
        : `${adminUser.full_name || adminUser.email} released ${current.first_name} ${current.last_name} back to house`,
    priority: "normal",
    entity_type: tableName,
    entity_id: registration_id,
    created_by: adminUser.id,
  });

  await auditLog(
    adminUser.id,
    adminUser.email,
    action === "claim" ? "claim_registration" : "release_registration",
    tableName,
    registration_id,
    {
      previous_ownership: current.ownership,
      new_ownership: newOwnership,
      previous_agent_id: current.agent_id,
      new_agent_id: action === "claim" ? agent_id : null,
    }
  );

  return NextResponse.json({
    success: true,
    message:
      action === "claim"
        ? "Registration claimed successfully"
        : "Registration released successfully",
  });
}
