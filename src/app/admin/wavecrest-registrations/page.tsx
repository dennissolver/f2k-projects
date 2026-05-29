// @explanatory-header-exempt — nested workflow page; entry-point header lives on the parent surface
import { createSupabaseService } from "@/lib/supabase-service";

export const dynamic = "force-dynamic";

interface WavecrestRegistration {
  id: string;
  created_at: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  interest_type: string | null;
  suburb: string | null;
  postcode: string | null;
  buyer_type: string | null;
  buyer_profile: string | null;
  current_housing: string | null;
  purchase_timeline: string | null;
  finance_status: string | null;
  how_heard: string | null;
  referrer_type: string | null;
  referrer_name: string | null;
  referrer_company: string | null;
  notes: string | null;
}

async function loadRegistrations(): Promise<WavecrestRegistration[]> {
  const supabase = createSupabaseService();
  const { data } = await (supabase.from("wavecrest_registrations") as any)
    .select("*")
    .order("created_at", { ascending: false });
  return (data as WavecrestRegistration[]) || [];
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function WavecrestRegistrationsPage() {
  const registrations = await loadRegistrations();

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Wavecrest Registrations</h1>
          <p className="text-sm text-slate-600 mt-1">
            Registration of Interest — {registrations.length} total
          </p>
        </div>
      </div>

      {registrations.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-500">No registrations yet</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">Name</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">Email</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">Phone</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">Interest</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">Location</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">Buyer Type</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">Timeline</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">Registered</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {registrations.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      {r.first_name} {r.last_name}
                    </td>
                    <td className="px-4 py-3">
                      <a href={`mailto:${r.email}`} className="text-blue-600 hover:underline">
                        {r.email}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {r.phone || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {r.interest_type || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {r.suburb ? `${r.suburb} ${r.postcode}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {r.buyer_type || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {r.purchase_timeline || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {fmtDateTime(r.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
