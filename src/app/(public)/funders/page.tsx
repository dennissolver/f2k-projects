import { Metadata } from "next";
import FundersOverview from "@/components/funders/FundersOverview";

export const metadata: Metadata = {
  title: "For Funders — The F2K funding model | Factory2Key",
  description:
    "How Factory2Key-led developments are funded: demand is the trigger. The back-to-back model and the senior/junior capital stack, for registered Australian banks (APRA-authorised ADIs). Registration of interest only — not an offer.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "For Funders — The F2K funding model",
    description:
      "Demand is the trigger. The back-to-back funding model + senior/junior capital stack, for registered Australian banks.",
    url: "https://f2k-projects.vercel.app/funders",
    siteName: "Factory2Key Projects",
    type: "website",
  },
};

export default function FundersPage() {
  return <FundersOverview />;
}
