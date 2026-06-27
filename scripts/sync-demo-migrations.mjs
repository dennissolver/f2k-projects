// Apply newly-added migrations to the DEMO Supabase automatically (CI).
//
// The demo (f2k-projects-demo) deploys CODE from this same repo, but runs its
// OWN Supabase (cjlcywifsrwcecajammi) — so migrations must be applied to it
// separately. This script does that on every push to main via the GitHub
// Action .github/workflows/demo-db-sync.yml: it finds the migration files ADDED
// in the push and applies any whose version is not yet recorded in the demo's
// schema_migrations, then records them.
//
// Runs DDL through the Supabase Management API query endpoint (needs only the
// access token — no demo DB password). Idempotent: a version already recorded
// is skipped; the migrations themselves use IF NOT EXISTS / ON CONFLICT.
//
// Env:
//   SUPABASE_ACCESS_TOKEN  (required) — Supabase Management API token
//   DEMO_PROJECT_REF       (default cjlcywifsrwcecajammi)
//   GITHUB_EVENT_BEFORE / GITHUB_SHA  — push range; falls back to HEAD~1..HEAD

import { readFileSync, readdirSync } from "node:fs";
import { execSync } from "node:child_process";

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const REF = process.env.DEMO_PROJECT_REF || "cjlcywifsrwcecajammi";
if (!TOKEN) { console.error("SUPABASE_ACCESS_TOKEN not set"); process.exit(1); }

const MIG_DIR = "supabase/migrations";

async function runSql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`query failed ${res.status}: ${text.slice(0, 400)}`);
  try { return JSON.parse(text); } catch { return text; }
}

function versionOf(filename) {
  return filename.split("_")[0]; // "0062_estate..." -> "0062"
}

function addedMigrationFiles() {
  // Files ADDED under supabase/migrations in this push. Fall back to last commit.
  const before = process.env.GITHUB_EVENT_BEFORE;
  const after = process.env.GITHUB_SHA || "HEAD";
  const range =
    before && !/^0+$/.test(before) ? `${before} ${after}` : `HEAD~1 ${after}`;
  let out = "";
  try {
    out = execSync(`git diff --name-only --diff-filter=A ${range} -- ${MIG_DIR}`, {
      encoding: "utf8",
    });
  } catch (e) {
    console.warn("git diff failed; nothing to do:", e.message);
    return [];
  }
  return out.split("\n").map((s) => s.trim()).filter((s) => s.endsWith(".sql"));
}

async function main() {
  const added = addedMigrationFiles();
  if (added.length === 0) { console.log("No new migration files in this push."); return; }
  console.log(`New migration file(s): ${added.map((f) => f.split("/").pop()).join(", ")}`);

  // ensure the tracking table exists
  await runSql(
    "create schema if not exists supabase_migrations;" +
    " create table if not exists supabase_migrations.schema_migrations (version text not null primary key, statements text[], name text);",
  );
  const appliedRows = await runSql("select version from supabase_migrations.schema_migrations;");
  const applied = new Set((appliedRows || []).map((r) => r.version));

  // apply in version order
  const files = added
    .filter((f) => readdirSync(MIG_DIR).includes(f.split("/").pop())) // still present
    .sort();

  for (const f of files) {
    const name = f.split("/").pop();
    const version = versionOf(name);
    if (applied.has(version)) { console.log(`= ${name} already recorded on demo, skip`); continue; }
    const sql = readFileSync(f, "utf8");
    console.log(`+ applying ${name} to demo (${REF})...`);
    await runSql(sql);
    await runSql(
      `insert into supabase_migrations.schema_migrations (version, name) values ('${version}', '${name.replace(/\.sql$/, "").slice(5).replace(/'/g, "''")}') on conflict (version) do nothing;`,
    );
    console.log(`  done: ${name}`);
  }
  console.log("Demo migration sync complete.");
}

main().catch((e) => { console.error("demo sync FAILED:", e.message); process.exit(1); });
