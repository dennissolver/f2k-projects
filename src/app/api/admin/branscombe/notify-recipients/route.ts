import { NextResponse } from "next/server";
import { auditLog, getAdminUser, hasPermission } from "@/lib/admin-auth";
import { createSupabaseService } from "@/lib/supabase-service";

export const dynamic = "force-dynamic";

type RecipientRow = {
  email: string;
  name: string | null;
  active: boolean;
  added_at: string;
  updated_at: string;
};

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export async function GET() {
  const admin = await getAdminUser();
  if (!admin || !hasPermission(admin.role, "manage_branscombe_notifications")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createSupabaseService();
  const { data, error } = await (
    supabase.from("branscombe_notify_recipients") as any
  )
    .select("email, name, active, added_at, updated_at")
    .order("added_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ recipients: (data ?? []) as RecipientRow[] });
}

export async function POST(req: Request) {
  const admin = await getAdminUser();
  if (!admin || !hasPermission(admin.role, "manage_branscombe_notifications")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { email?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = (body.email || "").trim().toLowerCase();
  const name = (body.name || "").trim() || null;
  if (!email || !isValidEmail(email)) {
    return NextResponse.json(
      { error: "A valid email address is required" },
      { status: 400 },
    );
  }

  const supabase = createSupabaseService();
  const { data, error } = await (
    supabase.from("branscombe_notify_recipients") as any
  )
    .upsert(
      {
        email,
        name,
        active: true,
        added_by: admin.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "email" },
    )
    .select("email, name, active, added_at, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await auditLog(
    admin.id,
    admin.email,
    "branscombe_notify_recipient_added",
    "branscombe_notify_recipients",
    email,
    { name },
  );

  return NextResponse.json({ recipient: data as RecipientRow });
}

export async function DELETE(req: Request) {
  const admin = await getAdminUser();
  if (!admin || !hasPermission(admin.role, "manage_branscombe_notifications")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const email = (url.searchParams.get("email") || "").trim().toLowerCase();
  if (!email) {
    return NextResponse.json(
      { error: "email query param required" },
      { status: 400 },
    );
  }

  const supabase = createSupabaseService();
  const { error } = await (
    supabase.from("branscombe_notify_recipients") as any
  )
    .delete()
    .eq("email", email);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await auditLog(
    admin.id,
    admin.email,
    "branscombe_notify_recipient_removed",
    "branscombe_notify_recipients",
    email,
    {},
  );

  return NextResponse.json({ ok: true });
}
