/**
 * Templated Resend send helper. F2KSFLDS-9.
 *
 * Reads a row from email_templates by slug, interpolates {{variable}}
 * placeholders with HTML-escaped values, sends via Resend using the
 * Corporate AI Solutions verified sender, and writes an audit_log row
 * with action='email_sent'.
 *
 * Calling convention:
 *
 *   const result = await sendTemplated({
 *     slug: "registration_confirmation",
 *     to: "user@example.com",
 *     variables: { first_name: "Jane", lot_list: "Lot 332, Lot 333" },
 *     audit: {
 *       actorEmail: "system@factory2key.com.au",
 *       entityType: "seafields_registration",
 *       entityId: registrationId,
 *     },
 *   });
 *
 * `result.error` is null on success and a string on failure.
 * Callers MUST treat sends as best-effort — never block a user-facing
 * response on a Resend latency hiccup. Wrap in try/catch and log.
 *
 * Plain-text bodies are passed through unchanged (variables interpolated
 * without HTML escaping — Resend treats text/plain as opaque).
 */
import { createSupabaseService } from "@/lib/supabase-service";
import { escapeHtml } from "@/lib/html-escape";
import { guardRecipients } from "@/lib/email/recipient-guard";

const FROM_DEFAULT =
  "Seafields Estate <noreply@updates.corporateaisolutions.com>";

type AuditContext = {
  actorEmail: string;
  entityType: string;
  entityId?: string | null;
};

export type SendTemplatedArgs = {
  slug: string;
  to: string | string[];
  variables?: Record<string, string | number | null | undefined>;
  audit: AuditContext;
  /** Override the default From — rarely needed. Must be a Resend-verified sender. */
  from?: string;
  /** Optional reply-to so registrants reach a real inbox. */
  replyTo?: string;
  /**
   * The submitter/actor email this send is on behalf of. Lets the recipient
   * guard catch production test-traffic even when `to` is a real recipient.
   */
  triggeredByEmail?: string | null;
  /**
   * When set, append the Spam-Act compliance footer (Factory2Key ID + ABN + a signed
   * one-click unsubscribe for this address) to the rendered html + text. Use for any
   * registrant-facing commercial/acknowledgement template.
   */
  appendComplianceFooterFor?: string;
};

export type SendTemplatedResult = {
  error: string | null;
  skipped?: boolean;
  resend_id?: string;
};

/**
 * Replace {{variable_name}} placeholders. Missing variables stay rendered
 * as the literal placeholder so a template content bug surfaces in the
 * delivered email rather than silently dropping text.
 */
function interpolate(
  template: string,
  variables: Record<string, string | number | null | undefined>,
  htmlEscape: boolean,
): string {
  return template.replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, (match, key) => {
    if (!(key in variables)) return match;
    const raw = variables[key];
    if (raw == null) return "";
    const str = String(raw);
    return htmlEscape ? escapeHtml(str) : str;
  });
}

export async function sendTemplated(
  args: SendTemplatedArgs,
): Promise<SendTemplatedResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { error: "RESEND_API_KEY not configured", skipped: true };
  }

  const supabase = createSupabaseService();

  const { data: tpl, error: tplErr } = await (supabase
    .from("email_templates") as any)
    .select("slug, subject, html_body, text_body, is_active")
    .eq("slug", args.slug)
    .maybeSingle();

  if (tplErr) {
    return { error: `email_templates lookup failed: ${tplErr.message}` };
  }
  if (!tpl) {
    return { error: `Template "${args.slug}" not found` };
  }
  if (!tpl.is_active) {
    return { error: null, skipped: true };
  }

  const vars = args.variables ?? {};
  const subject = interpolate(tpl.subject, vars, false);
  let html = interpolate(tpl.html_body, vars, true);
  let text = tpl.text_body ? interpolate(tpl.text_body, vars, false) : undefined;

  // Spam-Act compliance footer (identification + ABN + signed unsubscribe), appended after
  // interpolation so the footer HTML isn't escaped by the template's variable-escaping.
  if (args.appendComplianceFooterFor) {
    const { registrantAckFooterHtml, registrantAckFooterText } = await import(
      "@/lib/email/unsubscribe"
    );
    html = `${html}\n${registrantAckFooterHtml(args.appendComplianceFooterFor)}`;
    text = `${text ?? ""}\n\n${registrantAckFooterText(args.appendComplianceFooterFor)}`;
  }

  // Keep test-tester + non-production traffic out of real recipients' inboxes.
  const guard = guardRecipients(args.to, { triggeredByEmail: args.triggeredByEmail });

  let resendId: string | undefined;
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    const sendArgs: {
      from: string;
      to: string | string[];
      subject: string;
      html: string;
      text?: string;
      replyTo?: string;
    } = {
      from: args.from || process.env.RESEND_FROM_EMAIL || FROM_DEFAULT,
      to: guard.to,
      subject,
      html,
    };
    if (text) sendArgs.text = text;
    if (args.replyTo) sendArgs.replyTo = args.replyTo;
    const result = await resend.emails.send(sendArgs);
    if (result.error) {
      return { error: result.error.message ?? String(result.error) };
    }
    resendId = result.data?.id;
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Resend send threw",
    };
  }

  // Audit attribution. Never blocks the return — if the audit insert fails
  // we still surface the successful send to the caller.
  try {
    await supabase.from("audit_log").insert({
      actor_id: null,
      actor_email: args.audit.actorEmail,
      action: "email_sent",
      entity_type: args.audit.entityType,
      entity_id: args.audit.entityId ?? null,
      details: {
        template_slug: args.slug,
        to: guard.to,
        intended_to: guard.original,
        rerouted: guard.rerouted,
        reroute_reason: guard.reason,
        subject,
        resend_id: resendId ?? null,
      },
    });
  } catch (err) {
    console.error("audit_log email_sent insert failed", err);
  }

  return { error: null, resend_id: resendId };
}
