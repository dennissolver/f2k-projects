import { NextResponse } from "next/server";
import { createSupabaseService } from "@/lib/supabase-service";

export async function POST() {
  const supabase = createSupabaseService();

  const TEST_PATTERNS = /test|qa|marcus|testerton|testbuyer|qatester/i;

  // First get all registrations that match test patterns
  const { data: registrations } = await (supabase
    .from("seafields_registrations") as any)
    .select("id, first_name, last_name, email, phone");

  const testIds: string[] = [];
  for (const r of (registrations || []) as any[]) {
    const name = `${r.first_name} ${r.last_name}`.toLowerCase();
    const email = (r.email || "").toLowerCase();
    const phone = r.phone || "";
    if (TEST_PATTERNS.test(name) || TEST_PATTERNS.test(email) || TEST_PATTERNS.test(phone)) {
      testIds.push(r.id);
    }
  }

  if (testIds.length === 0) {
    return NextResponse.json({ deleted: 0 });
  }

  // Delete the registrations (cascade should handle lot allocations)
  const { error } = await (supabase
    .from("seafields_registrations") as any)
    .delete()
    .in("id", testIds);

  if (error) {
    console.error("Error deleting test data:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ deleted: testIds.length });
}
