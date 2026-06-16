// One-off: honour a removal/opt-out request for a single email in
// seafields_employer_prospects. Sets outreach_status='unsubscribed' +
// unsubscribed_at=now() (mirrors the one-click unsubscribe route) and stamps a
// provenance note. Durable: the live send only targets status='imported', and the
// re-runnable importer skips existing emails, so this won't be resurrected.
//
// Usage: node scripts/remove-prospect-email.mjs <email> "<note>"
import pg from "pg";
import { readFileSync } from "node:fs";

function env(name) {
  if (process.env[name]) return process.env[name];
  try {
    const txt = readFileSync(".env.local", "utf8");
    const m = txt.match(new RegExp(`^${name}\\s*=\\s*"?([^"\\r\\n]+)"?`, "m"));
    return m ? m[1].trim() : undefined;
  } catch {
    return undefined;
  }
}

const email = (process.argv[2] || "").trim().toLowerCase();
const note = process.argv[3] || "Manual removal request honoured.";
if (!email) {
  console.error('Usage: node scripts/remove-prospect-email.mjs <email> "<note>"');
  process.exit(1);
}

const CONN = env("POSTGRES_URL_NON_POOLING") || env("POSTGRES_URL");
const client = new pg.Client({ connectionString: CONN, ssl: { rejectUnauthorized: false } });
await client.connect();

const res = await client.query(
  `UPDATE public.seafields_employer_prospects
     SET outreach_status = 'unsubscribed',
         unsubscribed_at = NOW(),
         notes = COALESCE(notes || ' | ', '') || $2
   WHERE lower(email) = $1
   RETURNING id, business_name, contact_person, email, outreach_status, unsubscribed_at, notes`,
  [email, note],
);

console.log(`Rows updated: ${res.rowCount}`);
for (const r of res.rows) console.log(JSON.stringify(r, null, 2));
await client.end();
