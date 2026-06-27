import { Metadata } from "next";
import QualificationForm, { type UnitOption } from "@/components/roi/QualificationForm";
import { parseQualifyToken } from "@/lib/roi/qualify-link";
import { createSupabaseService } from "@/lib/supabase-service";
import { colourSchemesForEstate } from "@/lib/roi/estate-config";

export const metadata: Metadata = {
  title: "Complete your registration — Branscombe Estate | F2K",
  robots: { index: false, follow: false },
};

function InvalidLink() {
  return (
    <main className="min-h-screen bg-off-white flex items-center justify-center px-4 py-20">
      <div className="max-w-md text-center bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
        <h1 className="text-xl font-bold text-[#1A2744] mb-2">This link can&apos;t be opened</h1>
        <p className="text-slate-600 text-base leading-relaxed">
          Your registration link is invalid or has expired. Please ask your agent or Factory2Key to
          send you a new one.
        </p>
      </div>
    </main>
  );
}

export default async function BranscombeQualifyPage({
  searchParams,
}: {
  searchParams: { t?: string };
}) {
  const tok = parseQualifyToken(searchParams?.t);
  if (!tok) return <InvalidLink />;

  const supabase = createSupabaseService();
  const { data: waitlist } = await (supabase.from("waitlist_registrations") as any)
    .select("id, estate_id, name, email, mobile, buyer_category")
    .eq("id", tok.waitlistId)
    .maybeSingle();
  if (!waitlist) return <InvalidLink />;

  const { data: estate } = await (supabase.from("estates") as any)
    .select("slug, name")
    .eq("id", waitlist.estate_id)
    .maybeSingle();
  if (!estate) return <InvalidLink />;

  // Representation guardrail (spec §8): only authorised units expose type/beds/area detail.
  const { data: units } = await (supabase.from("units") as any)
    .select(
      "unit_number, type_code, bedrooms, bathrooms, internal_area_m2, authorised_for_display, status",
    )
    .eq("estate_id", waitlist.estate_id)
    .eq("status", "available")
    .order("unit_number", { ascending: true });

  const unitOptions: UnitOption[] = (units ?? []).map((u: any) => {
    if (u.authorised_for_display) {
      const bits = [
        u.bedrooms != null ? `${u.bedrooms} bed` : null,
        u.bathrooms != null ? `${u.bathrooms} bath` : null,
        u.internal_area_m2 != null ? `${u.internal_area_m2}m²` : null,
      ].filter(Boolean);
      return {
        number: u.unit_number,
        label: `Home ${u.unit_number}${bits.length ? ` — ${bits.join(" / ")}` : ""}`,
      };
    }
    // Unauthorised: selectable by number only — no type/area detail rendered.
    return { number: u.unit_number, label: `Home ${u.unit_number}` };
  });

  return (
    <main className="min-h-screen bg-off-white">
      <section className="bg-[#1A2744] text-white px-4 py-10 sm:py-14">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-[#00B5AD] text-sm font-semibold tracking-wide mb-2">
            {estate.name.toUpperCase()}
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold mb-3">Complete your registration</h1>
          <p className="text-white/80 text-base leading-relaxed max-w-2xl mx-auto">
            Note your preferred home(s) and indicative terms. This is an expression of interest
            only — no deposit, no obligation, and nothing is binding until a contract is signed.
          </p>
        </div>
      </section>

      <section className="px-4 py-10">
        <QualificationForm
          token={searchParams!.t as string}
          estateName={estate.name}
          units={unitOptions}
          colours={colourSchemesForEstate(estate.slug)}
          prefill={{
            full_name: waitlist.name ?? "",
            email: waitlist.email ?? "",
            mobile: waitlist.mobile ?? "",
            buyer_category: waitlist.buyer_category ?? "",
          }}
        />
      </section>
    </main>
  );
}
