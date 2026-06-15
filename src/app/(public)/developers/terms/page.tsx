import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Estate submission terms | Factory2Key for developers",
  description:
    "How Factory2Key works with developers and landowners who submit an estate: free to submit, F2K as estate manager leading the project, allocations, management and delivery.",
  robots: { index: false, follow: false },
};

export default function DeveloperTermsPage() {
  return (
    <div className="bg-off-white min-h-screen">
      <section className="bg-[#142C44] text-white">
        <div className="max-w-3xl mx-auto px-5 sm:px-8 py-12">
          <p className="font-ibm-mono text-xs tracking-[0.4em] uppercase text-[#00B5AD] mb-3">
            For developers &amp; landowners
          </p>
          <h1 className="font-archivo text-3xl font-black leading-tight">Estate submission — how we work</h1>
          <p className="font-archivo text-white/70 text-base mt-4 max-w-2xl leading-relaxed">
            Submitting an estate to Factory2Key is free. This sets out the basis on which we take it
            forward, in plain terms.
          </p>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-5 sm:px-8 py-10 font-archivo text-slate leading-relaxed space-y-6">
        <div>
          <h2 className="font-archivo text-xl font-black text-deep-blue mb-2">Free to submit</h2>
          <p>
            There is no fee to submit your estate. We assess it, and where it stacks up we build the
            sales page, validate buyer demand, and work up a funder feasibility — at our cost.
          </p>
        </div>

        <div>
          <h2 className="font-archivo text-xl font-black text-deep-blue mb-2">Factory2Key as estate manager</h2>
          <p>
            We make this work because Factory2Key acts as the <strong>estate manager and delivery
            partner</strong> for the projects we take on — leading the project, the lot/home
            allocations, the management of the development, and the delivery of the homes as
            factory-built modular dwellings. That is how we earn our return: by controlling the land
            programme and delivering the housing, not by charging you to submit.
          </p>
          <p className="mt-2">
            By submitting, you acknowledge that you&apos;re engaging us on that basis. The specific
            commercial structure (outright, joint venture, staged, etc.) is agreed with you per
            project and set out in formal documentation before anything is binding — this page is the
            basis of engagement, not the contract.
          </p>
        </div>

        <div>
          <h2 className="font-archivo text-xl font-black text-deep-blue mb-2">If you&apos;re an agent or not the owner</h2>
          <p>
            If you&apos;re submitting on a landowner&apos;s behalf (for example, as their agent),
            you&apos;re confirming you have their authority to do so — or that you&apos;ll arrange the
            owner&apos;s confirmation. We&apos;ll always confirm directly with the landowner before any
            commitment.
          </p>
        </div>

        <div>
          <h2 className="font-archivo text-xl font-black text-deep-blue mb-2">No obligation until documented</h2>
          <p>
            A submission is an expression of interest. It creates no binding obligation on either side
            until a formal agreement is signed. We&apos;d rather have an early, honest conversation than
            hold anyone to fine print — so if anything here needs talking through, just ask.
          </p>
        </div>

        <p className="text-sm text-slate/60">
          Questions? Email{" "}
          <a href="mailto:dennis@factory2key.com.au" className="text-[#1B3A5B] underline">dennis@factory2key.com.au</a>.
        </p>
      </div>
    </div>
  );
}
