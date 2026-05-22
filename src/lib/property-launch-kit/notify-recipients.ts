/**
 * Generic recipient lookup for product notification lists.
 *
 * Each product has its own `{product}_notify_recipients` table with the
 * same shape (email PK, name, active, audit cols). This helper centralises
 * the read + fallback logic so per-product notify modules become thin
 * shims.
 */

import { createSupabaseService } from "@/lib/supabase-service";

interface Options {
  /** Table name (e.g. "seafields_notify_recipients"). */
  table: string;
  /** Hardcoded recipients used when the table lookup fails or returns
   * empty. Ensures a misconfigured DB never strands the notification
   * path. */
  fallback: string[];
}

export async function getActiveRecipients(opts: Options): Promise<string[]> {
  try {
    const supabase = createSupabaseService();
    const { data, error } = await (supabase.from(opts.table) as any)
      .select("email")
      .eq("active", true);
    if (error) return opts.fallback;
    const list = (data ?? []) as { email: string }[];
    if (list.length === 0) return opts.fallback;
    return list.map((r) => r.email);
  } catch {
    return opts.fallback;
  }
}
