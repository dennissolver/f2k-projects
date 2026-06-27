import { Metadata } from "next";
import WaitlistForm from "@/components/roi/WaitlistForm";

export const metadata: Metadata = {
  title: "Register your interest — Branscombe Estate | F2K",
  description:
    "Join the Branscombe Estate waitlist — 37 architecturally designed single-storey homes in Claremont, Tasmania. No deposit, no obligation.",
};

export default function BranscombeRegisterPage() {
  return (
    <main className="min-h-screen bg-off-white">
      <section className="bg-[#1A2744] text-white px-4 py-12 sm:py-16">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-[#00B5AD] text-sm font-semibold tracking-wide mb-2">
            BRANSCOMBE ESTATE · CLAREMONT, TASMANIA
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">Register your interest</h1>
          <p className="text-white/80 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto">
            36 of the 37 homes are 3-bedroom; Unit 31 is currently approved as 2-bedroom (an
            amendment is being prepared, subject to Council approval). Join the waitlist to stay
            updated — there&apos;s no deposit and no obligation.
          </p>
        </div>
      </section>

      <section className="px-4 py-12">
        <WaitlistForm estate="branscombe" estateName="Branscombe Estate" />
      </section>
    </main>
  );
}
