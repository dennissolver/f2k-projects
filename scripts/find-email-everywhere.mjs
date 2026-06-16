// One-off: locate a given email address ANYWHERE in the live DB.
// Scans every public-schema text/varchar column whose name contains "email"
// (covers email, additional_emails, contact_email, etc.), case-insensitively,
// using LIKE so semicolon-packed multi-email columns are matched too.
//
// Read-only. Usage: node scripts/find-email-everywhere.mjs <email>
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

const target = (process.argv[2] || "").trim().toLowerCase();
if (!target) {
  console.error("Usage: node scripts/find-email-everywhere.mjs <email>");
  process.exit(1);
}

const CONN = env("POSTGRES_URL_NON_POOLING") || env("POSTGRES_URL");
if (!CONN) {
  console.error("Missing POSTGRES_URL_NON_POOLING / POSTGRES_URL in .env.local");
  process.exit(1);
}

const client = new pg.Client({ connectionString: CONN, ssl: { rejectUnauthorized: false } });
await client.connect();

const cols = await client.query(`
  SELECT table_name, column_name
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND data_type IN ('text','character varying')
    AND column_name ILIKE '%email%'
  ORDER BY table_name, column_name
`);

const like = `%${target}%`;
let hits = 0;
for (const { table_name, column_name } of cols.rows) {
  const q = `SELECT * FROM public."${table_name}" WHERE lower("${column_name}") LIKE $1`;
  let res;
  try {
    res = await client.query(q, [like]);
  } catch (e) {
    console.log(`  ! skip ${table_name}.${column_name}: ${e.message}`);
    continue;
  }
  if (res.rows.length) {
    hits += res.rows.length;
    console.log(`\n=== ${table_name}.${column_name} — ${res.rows.length} row(s) ===`);
    for (const r of res.rows) console.log(JSON.stringify(r, null, 2));
  }
}

console.log(`\nTotal matching rows: ${hits} (target: ${target})`);
await client.end();
