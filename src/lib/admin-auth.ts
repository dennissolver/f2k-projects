import { createSupabaseServer } from "./supabase-server";
import { createSupabaseService } from "./supabase-service";

export type AdminRole = "super_admin" | "fund_manager" | "compliance" | "read_only";

export interface AdminUser {
  id: string;
  auth_user_id: string;
  email: string;
  role: AdminRole;
  full_name: string | null;
  created_at: string;
}

export async function getAdminUser(): Promise<AdminUser | null> {
  const supabase = createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const service = createSupabaseService();

  // Primary lookup — by auth_user_id (set by the link trigger on auth.users INSERT).
  const { data: byAuth } = await service
    .from("admin_users")
    .select("*")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (byAuth) return byAuth as AdminUser;

  // Self-heal fallback — link by email if trigger somehow didn't fire.
  if (user.email) {
    const { data: byEmail } = await service
      .from("admin_users")
      .select("*")
      .eq("email", user.email)
      .is("auth_user_id", null)
      .maybeSingle();

    if (byEmail) {
      await service
        .from("admin_users")
        .update({ auth_user_id: user.id })
        .eq("id", (byEmail as AdminUser).id);
      return { ...(byEmail as AdminUser), auth_user_id: user.id };
    }
  }

  return null;
}

export function hasPermission(role: AdminRole, action: string): boolean {
  // Purchaser-portal permission map only. Fund-only actions (NAV, KYC, allowlist,
  // distributions, stakes, asset classes) intentionally removed.
  const permissions: Record<string, AdminRole[]> = {
    view_audit_log: ["super_admin", "fund_manager", "compliance", "read_only"],
    view_registrations: ["super_admin", "fund_manager", "compliance", "read_only"],
    manage_registrations: ["super_admin", "fund_manager", "compliance"],
    manage_seafields_allocations: ["super_admin", "fund_manager"],
    manage_seafields_stages: ["super_admin", "fund_manager"],
    manage_branscombe_allocations: ["super_admin", "fund_manager"],
    manage_admin_users: ["super_admin"],
  };

  return permissions[action]?.includes(role) ?? false;
}

export async function auditLog(
  actorId: string,
  actorEmail: string,
  action: string,
  entityType: string,
  entityId: string | null,
  details: Record<string, unknown> = {},
) {
  const service = createSupabaseService();
  const { error } = await service.from("audit_log").insert({
    actor_id: actorId,
    actor_email: actorEmail,
    action,
    entity_type: entityType,
    entity_id: entityId,
    details,
  });
  if (error) {
    console.error("auditLog insert failed", {
      action,
      entityType,
      entityId,
      error: error.message,
    });
  }
}
