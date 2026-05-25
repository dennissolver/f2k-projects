import { NextResponse } from "next/server";
import { createSupabaseService } from "@/lib/supabase-service";
import { verifyUnsubscribeToken } from "@/lib/estates/email";

export const dynamic = "force-dynamic";

// Public — the signed token IS the authorisation (recipients aren't logged in).
// POST handles both the confirm-page form and the List-Unsubscribe one-click.
async function optOut(token: string | null): Promise<{ ok: boolean; error?: string; estate?: string }> {
  if (!token) return { ok: false, error: "Missing token" };
  const parsed = verifyUnsubscribeToken(token);
  if (!parsed) return { ok: false, error: "Invalid or expired unsubscribe link" };
  const supabase = createSupabaseService();
  const { error } = await (supabase.from("estate_email_optouts") as any)
    .upsert({ estate: parsed.estate, email: parsed.email.toLowerCase() }, { onConflict: "estate,email" });
  if (error) return { ok: false, error: error.message };
  return { ok: true, estate: parsed.estate };
}

export async function POST(request: Request) {
  const t = new URL(request.url).searchParams.get("t");
  const res = await optOut(t);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
