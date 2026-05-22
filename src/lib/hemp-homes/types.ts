export type HempHomesStage =
  | "design"
  | "material_development"
  | "engineering"
  | "prototyping"
  | "building"
  | "certification"
  | "install"
  | "community";

export type HempHomesState = "completed" | "in_progress" | "scheduled";

export const HEMP_HOMES_STAGES: { value: HempHomesStage; label: string }[] = [
  { value: "design", label: "Design" },
  { value: "material_development", label: "Material" },
  { value: "engineering", label: "Engineering" },
  { value: "prototyping", label: "Prototyping" },
  { value: "building", label: "Building" },
  { value: "certification", label: "Certification" },
  { value: "install", label: "Install" },
  { value: "community", label: "Community" },
];

export const HEMP_HOMES_STATES: { value: HempHomesState; label: string }[] = [
  { value: "scheduled", label: "Scheduled" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
];

export interface HempHomesPost {
  id: string;
  slug: string;
  title: string;
  overview: string;
  stage: HempHomesStage;
  state: HempHomesState;
  hero_media_id: string | null;
  published_at: string | null;
  email_sent_at: string | null;
  email_subject: string | null;
  email_preview: string | null;
  email_html: string | null;
  created_at: string;
  updated_at: string;
}

export interface HempHomesMedia {
  id: string;
  kind: "image" | "video";
  source: "direct" | "drive";
  storage_path: string;
  public_url: string;
  mime_type: string;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  byte_size: number | null;
  alt_text: string | null;
  caption: string | null;
  show_in_gallery: boolean;
  drive_file_id: string | null;
  drive_url: string | null;
  drive_synced_at: string | null;
  drive_modified_at: string | null;
  created_at: string;
}

export type HempHomesProspectStatus =
  | "researched"
  | "outreach_sent"
  | "in_conversation"
  | "committed"
  | "declined"
  | "paused";

export type HempHomesProspectSource = "workbook" | "llm_research" | "manual" | "inbound";

export type AusState = "QLD" | "NSW" | "VIC" | "TAS" | "SA" | "WA" | "NT" | "ACT";

export const HEMP_HOMES_PROSPECT_STATUSES: { value: HempHomesProspectStatus; label: string }[] = [
  { value: "researched", label: "Researched" },
  { value: "outreach_sent", label: "Outreach sent" },
  { value: "in_conversation", label: "In conversation" },
  { value: "committed", label: "Committed" },
  { value: "declined", label: "Declined" },
  { value: "paused", label: "Paused" },
];

export const AUS_STATES: { value: AusState; label: string }[] = [
  { value: "QLD", label: "QLD" },
  { value: "NSW", label: "NSW" },
  { value: "VIC", label: "VIC" },
  { value: "TAS", label: "TAS" },
  { value: "SA", label: "SA" },
  { value: "WA", label: "WA" },
  { value: "NT", label: "NT" },
  { value: "ACT", label: "ACT" },
];

export interface HempHomesProspect {
  id: string;
  name: string;
  slug: string;
  location: string | null;
  region: string | null;
  state: AusState | null;
  country: string;
  wave: 1 | 2 | 3 | null;
  status: HempHomesProspectStatus;
  website_url: string | null;
  land_size_acres: number | null;
  current_members: number | null;
  indicative_lot_potential: number | null;
  source: HempHomesProspectSource;
  source_basis: string | null;
  source_url: string | null;
  is_public_safe: boolean;
  notes: string | null;
  added_by: string | null;
  contact_owner: string | null;
  last_contacted_at: string | null;
  next_action: string | null;
  next_action_due: string | null;
  // Contact discovery (migration 0016)
  contact_emails: string[];
  contact_form_url: string | null;
  contact_phone: string | null;
  contact_discovery_notes: string | null;
  contact_discovered_at: string | null;
  // Outreach lifecycle (migration 0019)
  outreach_status: HempHomesProspectOutreachStatus;
  last_outreach_at: string | null;
  created_at: string;
  updated_at: string;
  // From the revenue view
  conservative_revenue?: number | null;
  base_revenue?: number | null;
  optimistic_revenue?: number | null;
}

export type HempHomesOutreachReviewStatus = "pending" | "approved" | "discarded" | "rerolled";
export type HempHomesOutreachDeliveryStatus = "queued" | "sent" | "bounced" | "complained" | "opened" | "clicked" | "replied";
export type HempHomesOutreachTriggerType = "stage_transition" | "time_gap" | "manual";
export type HempHomesProspectOutreachStatus = "idle" | "queued" | "sent" | "in_conversation" | "no_reply" | "paused" | "declined";

export interface HempHomesOutreachTemplate {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  trigger_type: HempHomesOutreachTriggerType;
  trigger_config: Record<string, unknown>;
  target_waves: number[] | null;
  target_statuses: string[] | null;
  target_states: string[] | null;
  subject_template: string;
  preview_template: string | null;
  body_md_template: string;
  llm_instruction: string | null;
  active: boolean;
  auto_send: boolean;
  created_at: string;
  updated_at: string;
}

export interface HempHomesProspectOutreach {
  id: string;
  prospect_id: string;
  template_id: string | null;
  generated_at: string;
  drafted_subject: string;
  drafted_preview: string | null;
  drafted_body_md: string;
  drafted_body_html: string | null;
  drafted_to_addresses: string[];
  review_status: HempHomesOutreachReviewStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  reviewer_edited: boolean;
  sent_at: string | null;
  resend_message_id: string | null;
  delivery_status: HempHomesOutreachDeliveryStatus | null;
  bounced_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  replied_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface HempHomesPricingAssumptions {
  id: "singleton";
  price_low: number;
  price_mid: number;
  price_high: number;
  capture_conservative: number;
  capture_base: number;
  capture_optimistic: number;
  updated_at: string;
}

export interface HempHomesJourneyEntry {
  id: string;
  slug: string;
  date_label: string;
  stage: HempHomesStage;
  state: HempHomesState;
  title: string;
  body: string;
  hero_media_id: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}
