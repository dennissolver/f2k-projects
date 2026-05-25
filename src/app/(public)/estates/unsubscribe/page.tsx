import { Suspense } from "react";
import type { Metadata } from "next";
import UnsubscribeClient from "./UnsubscribeClient";

export const metadata: Metadata = { title: "Unsubscribe | Factory2Key" };

export default function UnsubscribePage() {
  return (
    <main className="min-h-screen bg-off-white flex items-center justify-center px-4 py-16">
      <Suspense fallback={<div className="text-slate-500">Loading…</div>}>
        <UnsubscribeClient />
      </Suspense>
    </main>
  );
}
