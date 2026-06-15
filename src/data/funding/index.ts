import type { ProjectFunding } from "./types";
import { branscombeFunding } from "./branscombe";

// The funding registry — slug → funding model. Branscombe is the one project with a confirmed
// model (build brief §11). Seafields / Wavecrest / Hemp Homes are 'pending' until their finance
// models exist; their funder pages render the "stack pending confirmation" card, never figures.

export const FUNDING_PROJECTS: ProjectFunding[] = [
  branscombeFunding,
  {
    slug: "seafields-estate",
    name: "Seafields",
    location: "WA · agents active",
    status: "pending",
  },
  {
    slug: "wavecrest-estate",
    name: "Wavecrest",
    location: "WA",
    status: "pending",
  },
  {
    slug: "hemp-homes-for-eco-communities",
    name: "Hemp Homes",
    location: "Eco communities",
    status: "pending",
  },
];

export function getFunding(slug: string): ProjectFunding | undefined {
  return FUNDING_PROJECTS.find((p) => p.slug === slug);
}

export * from "./types";
export { branscombeFunding };
