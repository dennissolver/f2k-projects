import { redirect } from "next/navigation";

export const metadata = {
  title: "Wavecrest Estate — F2K Projects",
};

export default function WavecrestShortRedirect() {
  redirect("/wavecrest-estate");
}
