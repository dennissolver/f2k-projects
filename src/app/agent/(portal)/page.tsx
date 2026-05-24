"use client";

import { useEffect, useState } from "react";

interface Client {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  lots_selected: string[] | null;
  interest_type: string | null;
  buyer_type: string | null;
  purchase_timeline: string | null;
  created_at: string;
}

export default function MyClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/agent/my-clients");
        if (res.ok) setClients((await res.json()).clients || []);
        else setError("Couldn't load your clients.");
      } catch {
        setError("Network error.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-1">My Clients</h1>
      <p className="text-sm text-slate-500 mb-6 max-w-2xl">
        The buyers registered to you for Seafields Estate. These are the
        registrations linked to your agent account — you see their full details;
        all other buyers across the estate stay private.
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded px-3 py-2 text-sm text-red-700 mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-slate-500">Loading…</div>
      ) : clients.length === 0 ? (
        <div className="text-slate-400 text-sm border border-dashed rounded p-6 text-center">
          No clients linked to you yet. When a buyer you referred registers — or an
          admin assigns one to you — they&apos;ll appear here.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {clients.map((c) => (
            <div key={c.id} className="border border-slate-200 rounded-lg p-4 bg-white">
              <div className="font-semibold text-slate-900">
                {[c.first_name, c.last_name].filter(Boolean).join(" ") || "—"}
              </div>
              <div className="text-sm text-slate-500">{c.email}</div>
              {c.phone && <div className="text-sm text-slate-500">{c.phone}</div>}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {(c.lots_selected || []).map((l) => (
                  <span key={l} className="text-xs bg-[#00B5AD]/10 text-[#00766f] px-2 py-0.5 rounded">
                    {l.replace("L", "Lot ")}
                  </span>
                ))}
              </div>
              <div className="text-xs text-slate-500 mt-2 space-y-0.5">
                {c.interest_type && <div>{c.interest_type}</div>}
                {c.purchase_timeline && <div>Timeline: {c.purchase_timeline}</div>}
                <div className="text-slate-400">
                  Registered {new Date(c.created_at).toLocaleDateString("en-AU")}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
