// Apply a single migration's raw SQL to the DEMO Supabase (cjlcywifsrwcecajammi).
// Demo connection is built from live POSTGRES_URL per the recorded recipe:
//   ref earqebbwhklxadqawtex -> cjlcywifsrwcecajammi, region ap-northeast-2 -> ap-northeast-1,
//   password -> F2K_PROJECTS_DEMO_DB_PASSWORD, session port :5432 (NOT the :6543 pooler).
// Idempotent migrations only (CREATE/ALTER ... IF [NOT] EXISTS). Secrets never printed.
//
// Usage: node scripts/apply-migration-demo.mjs supabase/migrations/0059_xxx.sql
import pg from "pg";
import { readFileSync } from "node:fs";

function env(name) {
  if (process.env[name]) return process.env[name];
  const txt = readFileSync(".env.local", "utf8");
  const m = txt.match(new RegExp(`^${name}\\s*=\\s*"?([^"\\r\\n]+)"?`, "m"));
  return m ? m[1].trim() : undefined;
}

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/apply-migration-demo.mjs <path-to-migration.sql>");
  process.exit(1);
}

const live = env("POSTGRES_URL") || env("POSTGRES_URL_NON_POOLING");
const demoPassword = env("F2K_PROJECTS_DEMO_DB_PASSWORD");
if (!live || !demoPassword) {
  console.error("Missing POSTGRES_URL or F2K_PROJECTS_DEMO_DB_PASSWORD in .env.local");
  process.exit(1);
}

// Swap ref + region in the URL string, then set demo password + session port via URL parsing.
let demoStr = live
  .replace(/earqebbwhklxadqawtex/g, "cjlcywifsrwcecajammi")
  .replace(/ap-northeast-2/g, "ap-northeast-1");
const u = new URL(demoStr);
u.password = demoPassword;
u.port = "5432";
const demoUrl = u.toString();

const sql = readFileSync(file, "utf8");

const client = new pg.Client({ connectionString: demoUrl, ssl: { rejectUnauthorized: false } });
await client.connect();
console.log(`Connected to DEMO (host ${u.hostname}:${u.port}, ref cjlcywifsrwcecajammi). Applying ${file} ...`);
try {
  await client.query(sql);
  console.log("Applied OK.");
} catch (e) {
  console.error("Apply FAILED:", e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
