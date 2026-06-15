import { Metadata } from "next";
import { notFound } from "next/navigation";
import FunderProjectView from "@/components/funders/FunderProjectView";
import { getFunding, isConfirmedFunding } from "@/data/funding";

const SLUG = "branscombe-estate";

export const metadata: Metadata = {
  title: "Fund Branscombe — F2K funding | Factory2Key",
  description:
    "Register a senior or junior position in Branscombe's funding package. For registered Australian banks (APRA-authorised ADIs). Indicative until 3× cover; registration of interest only — not an offer.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "Fund Branscombe — Factory2Key",
    description:
      "Senior or junior position in Branscombe's funding package, for registered Australian banks.",
    url: "https://f2k-projects.vercel.app/branscombe-estate/funders",
    siteName: "Factory2Key Projects",
    type: "website",
  },
};

export default function BranscombeFundersPage() {
  const funding = getFunding(SLUG);
  if (!funding || !isConfirmedFunding(funding)) {
    // The funder page only renders once a confirmed finance model exists.
    notFound();
  }
  return <FunderProjectView project={funding} />;
}
