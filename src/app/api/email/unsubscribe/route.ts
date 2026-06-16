import { verifyEmailToken, suppressEmail } from "@/lib/email/unsubscribe";

export const dynamic = "force-dynamic";

/**
 * One-click unsubscribe for registrant acknowledgement / marketing emails.
 * GET /api/email/unsubscribe?e=<email>&t=<hmac>
 *
 * Verifies the signed token (so the link can't be forged/enumerated), records the address in
 * email_suppressions (idempotent), and shows a friendly confirmation. Returns the SAME page for a
 * bad/expired token so the endpoint never reveals membership. Spam-Act-compliant opt-out.
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
  <div class="hd"><h1>Factory2Key</h1></div>
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
  const url = new URL(request.url);
  const email = url.searchParams.get("e")?.trim().toLowerCase();
  const token = url.searchParams.get("t")?.trim();

  if (email && token && verifyEmailToken(email, token)) {
    try {
      await suppressEmail(email, { source: "registrant-unsubscribe" });
    } catch (err) {
      console.error("email unsubscribe error:", err);
      // Still confirm — opt-out intent is recorded best-effort; never leak failure state.
    }
  }
  // Generic confirmation regardless of token validity (no membership/validity leak).
  return page("You've been unsubscribed. We won't email you marketing updates again.");
}
