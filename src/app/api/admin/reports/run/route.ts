import { NextResponse } from "next/server";
import { getAdminUser, hasPermission } from "@/lib/admin-auth";
import { ReportQuerySpecSchema } from "@/lib/reports/query-spec";
import { executeReport } from "@/lib/reports/execute";

export const dynamic = "force-dynamic";

/**
 * Run a generic report from a VALIDATED ReportQuerySpec. Admin-gated, read-only. The spec is a
 * Zod-validated structured object — never LLM-authored SQL — so the model (Morgan) composes a spec
 * and this route runs only vetted, parameterised queries. This is what Morgan's confirmed request
 * and the building-block form both POST to.
 */
export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Not authorised." }, { status: 401 });
  if (!hasPermission(admin.role, "view_registrations")) {
    return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = ReportQuerySpecSchema.safeParse(body?.spec ?? body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: `Invalid report request: ${parsed.error.issues[0].message}` },
      { status: 400 },
    );
  }

  try {
    const result = await executeReport(parsed.data);
    return NextResponse.json({ result });
  } catch (err) {
    console.error("reports/run error:", err);
    return NextResponse.json(
      { error: "The report engine hit a snag. Please adjust the request and try again." },
      { status: 502 },
    );
  }
}
