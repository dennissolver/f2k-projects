import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client for read-only / unattributed work.
 * Writes that need audit attribution should use createSupabaseServiceWithActor.
 */
export function createSupabaseService() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Service-role client that stamps `x-actor-email` and (optionally)
 * `x-audit-reason` headers on every PostgREST request. The DB-level
 * audit_entity_change() trigger reads these via
 *   current_setting('request.headers')::jsonb
 * and writes them into audit_log rows. See migration 0008.
 *
 * Use this for any admin write — stages, lot allocations, registrations,
 * dwelling types, workbook merges — so every changed row carries the real
 * actor and reason instead of falling back to 'system' / NULL.
 *
 * `reason` is required for material changes by policy (see per-endpoint
 * validation); pass null for catalogue edits where no reason is needed.
 */
export function createSupabaseServiceWithActor(
  actorEmail: string,
  reason: string | null,
) {
  const headers: Record<string, string> = {
    "x-actor-email": actorEmail,
  };
  if (reason && reason.trim() !== "") {
    headers["x-audit-reason"] = reason.trim();
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { global: { headers } },
  );
}

/**
 * Service-role client that, in addition to actor/reason, sends
 *   x-allow-attribution-override: true
 * so the ROI portal's first-touch immutability trigger (migration 0063) PERMITS a change
 * to an already-set introducing_agent/agency — and logs it as `attribution_override`.
 *
 * Use ONLY for a deliberate admin re-assignment of an attributed lead. A first assignment
 * (NULL → agent) does not need this — the trigger allows the first touch.
 */
export function createSupabaseServiceWithAttributionOverride(
  actorEmail: string,
  reason: string,
) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      global: {
        headers: {
          "x-actor-email": actorEmail,
          "x-audit-reason": reason,
          "x-allow-attribution-override": "true",
        },
      },
    },
  );
}
