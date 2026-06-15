import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Funder terms — Factory2Key",
  description:
    "Terms for the Factory2Key funder pages. Directed to registered Australian banks (APRA-authorised ADIs). Registration of interest only.",
  robots: { index: false, follow: false },
};

// TODO(legal): wording is a placeholder for legal sign-off (build brief §9). Dennis to confirm
// final terms + any licensing with his lawyer, including whether arranging the senior/junior
// syndication + the retail-FRoR arrangement is a regulated activity in this bank-to-bank context.
export default function FunderTermsPage() {
  return (
    <div className="max-w-[760px] mx-auto px-4 py-16">
      <p className="font-ibm-mono text-[0.65rem] tracking-[0.4em] uppercase text-[#C77F3A] mb-3">
        Funder terms
      </p>
      <h1 className="font-archivo text-3xl font-black text-deep-blue mb-4">
        Funder terms &amp; registration notice
      </h1>
      <p className="font-archivo text-sm text-slate leading-relaxed mb-6">
        This notice applies to the Factory2Key funder pages and the registration of interest
        captured on them. It is directed to registered Australian banks (APRA-authorised ADIs)
        only.
      </p>

      <div className="space-y-5 font-archivo text-sm text-slate leading-relaxed">
        <p>
          <strong className="text-deep-blue">Audience.</strong> These pages are directed
          exclusively to registered Australian banks (APRA-authorised ADIs). They are not
          directed to retail clients or to the public, and nothing here is a public capital
          raise.
        </p>
        <p>
          <strong className="text-deep-blue">Registration of interest only.</strong> Submitting
          the form is a registration of interest only. It is not an offer or invitation, is not
          financial product advice, and creates no obligation on either side. Any participation
          is subject to formal documentation and due diligence.
        </p>
        <p>
          <strong className="text-deep-blue">Indicative figures.</strong> All project figures —
          package size, GRV, cost stack, margin and demand — are indicative estimates. They are
          confirmed only once a project&apos;s pre-qualified subscriptions reach 3× the lots
          released (300% cover), and remain subject to formal terms.
        </p>
        <p>
          <strong className="text-deep-blue">No guaranteed terms.</strong> Returns, ranking,
          security and timing between senior and junior participants are set in the term sheet
          and are subject to formal documentation. Nothing on these pages states or implies a
          guaranteed return, rate or ranking.
        </p>
        <p>
          <strong className="text-deep-blue">Privacy.</strong> Details you provide are used to
          contact you about funding the relevant project and are handled in line with
          Factory2Key&apos;s privacy practices.
        </p>
        <p className="text-slate/60 italic">
          Final wording is being confirmed with our legal adviser; this page will be updated.
        </p>
      </div>
    </div>
  );
}
