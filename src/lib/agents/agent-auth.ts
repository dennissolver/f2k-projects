import { createSupabaseServer } from "../supabase-server";
import { createSupabaseService } from "../supabase-service";

export interface AgentUser {
  id: string;
  auth_user_id: string;
  name: string;
  email: string;
  phone: string | null;
  agency: string | null;
  estate_access: string[];
  active: boolean;
  status: string;
}

/**
 * Resolve the currently-logged-in agent, or null. Mirrors getAdminUser():
 * reads the auth session via the SSR client, then looks the agent up with the
 * SERVICE role (bypasses RLS). Returns null unless there is a matching,
 * ACTIVE agents row — so a blocked agent (active=false), a deleted agent, or
 * any non-agent auth user (including admins) resolves to null.
 */
export async function getAgentUser(): Promise<AgentUser | null> {
  const supabase = createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const service = createSupabaseService();
  const { data } = await (service.from("agents") as any)
    .select(
      "id, auth_user_id, name, email, phone, agency, estate_access, active, status",
    )
    .eq("auth_user_id", user.id)
    .eq("active", true)
    .maybeSingle();

  return (data as AgentUser) ?? null;
}

/** True if the agent has access to the given estate ('seafields' | 'branscombe'). */
export function agentCanAccessEstate(agent: AgentUser, estate: string): boolean {
  return Array.isArray(agent.estate_access) && agent.estate_access.includes(estate);
}
