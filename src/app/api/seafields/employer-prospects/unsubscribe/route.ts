import { createSupabaseService } from "@/lib/supabase-service";

export const dynamic = "force-dynamic";

/**
 * One-click unsubscribe for the Seafields local-employer accommodation campaign.
 * GET /api/seafields/employer-prospects/unsubscribe?token=<unsubscribe_token>
 *
 * Flips the prospect's outreach_status to 'unsubscribed' (idempotent) and returns a
 * friendly confirmation page. Returns the SAME confirmation for unknown/invalid tokens
 * so the endpoint never reveals whether an address is on the list (and the campaign's
 * own test link resolves cleanly). Spam-Act compliant opt-out.
 */

function page(message: string): Response {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Unsubscribed — Factory2Key</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#F5F3EE;margin:0;color:#1f2a37;}
  .card{max-width:480px;margin:12vh auto;background:#fff;border:1px solid rgba(0,0,0,.06);border-radius:8px;overflow:hidden;}
  .hd{background:#142C44;padding:20px 28px;color:#fff;}
  .hd h1{margin:0;font-size:18px;}
  .bd{padding:28px;line-height:1.6;font-size:15px;}
  .bd p{margin:0 0 12px;}
  a{color:#1B3A5B;}
</style></head>
<body><div class="card">
  <div class="hd"><h1>Factory2Key · Seafields</h1></div>
  <div class="bd">
    <p>${message}</p>
    <p style="color:#667;font-size:13px;">If this was a mistake, email <a href="mailto:dennis@factory2key.com.au">dennis@factory2key.com.au</a> and we'll add you back.</p>
  </div>
</div></body></html>`;
  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token")?.trim();
  if (!token) {
    return page("No unsubscribe token was provided.");
  }

  try {
    const supabase = createSupabaseService();
    await supabase
      .from("seafields_employer_prospects")
      .update({
        outreach_status: "unsubscribed",
        unsubscribed_at: new Date().toISOString(),
      })
      .eq("unsubscribe_token", token)
      .neq("outreach_status", "unsubscribed");
  } catch (err) {
    console.error("employer unsubscribe error:", err);
    // Still show success — never leak state, and the opt-out intent is recorded best-effort.
  }

  return page(
    "You've been unsubscribed. We won't email you again about Seafields employer accommodation.",
  );
}
