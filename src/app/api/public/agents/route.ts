import { NextResponse } from "next/server";
import { createSupabaseService } from "@/lib/supabase-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Estate scoping: ?estate=<slug> returns ONLY agents whose estate_access includes that estate
  // (so a Tumby Bay form never lists a Hobart agent). No param = all active agents (back-compat).
  const estate = new URL(request.url).searchParams.get("estate")?.trim();
  const service = createSupabaseService();

  let query = (service.from("agents") as any)
    .select("id, name, email, agency, estate_access")
    .eq("active", true)
    .eq("status", "active")
    .order("name", { ascending: true });
  if (estate) query = query.contains("estate_access", [estate]);

  const { data, error } = await query;

  if (error) {
    console.error("public agents list error:", error);
    return NextResponse.json({ agents: [] });
  }

  return NextResponse.json({ agents: data ?? [] });
}
