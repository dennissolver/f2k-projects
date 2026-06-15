import { createSupabaseService } from "@/lib/supabase-service";

/**
 * Funder notification recipients. Mirrors src/lib/seafields/notify.ts: an admin-editable list in
 * funder_notify_recipients, with a hardcoded fallback so a notification never silently goes
 * nowhere if the table is empty. Read via the service role (bypasses RLS).
 */

const FALLBACK_RECIPIENTS = [
  "dennis@factory2key.com.au",
  "uwe@factory2key.com.au",
];

export async function getActiveFunderRecipients(): Promise<string[]> {
  try {
    const supabase = createSupabaseService();
    const { data, error } = await supabase
      .from("funder_notify_recipients")
      .select("email")
      .eq("active", true);
    if (error || !data || data.length === 0) return FALLBACK_RECIPIENTS;
    const emails = (data as { email: string }[])
      .map((r) => r.email)
      .filter(Boolean);
    return emails.length ? emails : FALLBACK_RECIPIENTS;
  } catch {
    return FALLBACK_RECIPIENTS;
  }
}
