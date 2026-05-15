#!/usr/bin/env node
/**
 * Apply Seafields launch migrations 0002–0006 to the live Supabase project.
 *
 * Reads the pooler connection string from a temp file:
 *   - Windows:  %TEMP%\f2k-conn.txt
 *   - POSIX:    $TMPDIR/f2k-conn.txt or /tmp/f2k-conn.txt
 *
 * Each migration file is executed as a single transaction. On any failure
 * the transaction rolls back and the script exits with a non-zero code —
 * no later files are attempted.
 *
 * After all five succeed, the verification queries from
 * /docs/migration-plan-0002.md §13 are run and printed.
 *
 * Usage (from repo root):
 *   node scripts/apply-seafields-migrations.mjs
 *
 * Does NOT print the connection string or password to stdout/stderr.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");

const CONN_FILE = join(tmpdir(), "f2k-conn.txt");

const MIGRATIONS = [
  "0002_seafields_stages_dwelling_types.sql",
  "0003_seafields_lot_columns.sql",
  "0004_seafields_registration_lots.sql",
  "0005_audit_log_trigger.sql",
  "0006_seafields_public_views.sql",
];

const VERIFICATION_QUERIES = [
  {
    label: "1. Stages — 7 rows, only Stage 1 open",
    sql: `SELECT stage_number, stage_label, is_open_for_registration, public_visible
          FROM stages ORDER BY stage_number`,
  },
  {
    label: "2. Dwelling types — 7 rows seeded",
    sql: `SELECT code, plan_name, bedrooms, is_active FROM dwelling_types ORDER BY code`,
  },
  {
    label: "3. Lot status distribution",
    sql: `SELECT status, COUNT(*)::int AS n
          FROM seafields_lot_allocations
          GROUP BY status ORDER BY status`,
  },
  {
    label: "4. Allocation bucket back-fill (NULLs need manual review)",
    sql: `SELECT allocated_to, allocation_bucket, COUNT(*)::int AS n
          FROM seafields_lot_allocations
          GROUP BY allocated_to, allocation_bucket
          ORDER BY allocated_to NULLS LAST`,
  },
  {
    label: "5. registration_lots back-fill row count",
    sql: `SELECT COUNT(*)::int AS join_rows,
                 (SELECT COALESCE(SUM(array_length(lots_selected,1)), 0)::int
                  FROM seafields_registrations) AS expected_from_arrays
          FROM seafields_registration_lots`,
  },
  {
    label: "6. Audit triggers attached",
    sql: `SELECT event_object_table AS table_name, trigger_name, action_timing, event_manipulation
          FROM information_schema.triggers
          WHERE trigger_name LIKE 'trg_audit_%'
          ORDER BY event_object_table, event_manipulation`,
  },
  {
    label: "7. Public view returns rows with computed pricing",
    sql: `SELECT lot_number, status, stage_number, effective_rate_per_sqm
          FROM seafields_public_lots
          ORDER BY lot_number LIMIT 5`,
  },
  {
    label: "8. stages_with_escalation view",
    sql: `SELECT stage_number, rate_per_sqm, escalation_pct
          FROM stages_with_escalation ORDER BY stage_number`,
  },
];

function loadConnString() {
  if (!existsSync(CONN_FILE)) {
    console.error(`✗ Connection file not found at ${CONN_FILE}`);
    console.error(`  Run in PowerShell:`);
    console.error(`    Set-Content -Path "$env:TEMP\\f2k-conn.txt" -Value 'postgresql://...'`);
    process.exit(1);
  }
  const conn = readFileSync(CONN_FILE, "utf8").trim();
  if (!conn.startsWith("postgresql://") && !conn.startsWith("postgres://")) {
    console.error(`✗ ${CONN_FILE} does not contain a valid postgres URL.`);
    process.exit(1);
  }
  return conn;
}

async function applyMigration(client, filename) {
  const path = join(REPO_ROOT, "supabase", "migrations", filename);
  if (!existsSync(path)) {
    throw new Error(`Migration file missing: ${path}`);
  }
  const sql = readFileSync(path, "utf8");
  const started = Date.now();

  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("COMMIT");
    const ms = Date.now() - started;
    console.log(`  ✓ ${filename}  (${ms}ms)`);
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch {}
    console.error(`  ✗ ${filename}  FAILED`);
    console.error(`    ${err.message}`);
    if (err.position) console.error(`    at position: ${err.position}`);
    if (err.detail)   console.error(`    detail: ${err.detail}`);
    if (err.hint)     console.error(`    hint: ${err.hint}`);
    throw err;
  }
}

async function runVerification(client) {
  console.log("");
  console.log("── Verification ────────────────────────────────────────────────");
  for (const v of VERIFICATION_QUERIES) {
    console.log("");
    console.log(`▸ ${v.label}`);
    try {
      const { rows } = await client.query(v.sql);
      if (rows.length === 0) {
        console.log("  (no rows)");
      } else {
        for (const row of rows) {
          console.log("  " + JSON.stringify(row));
        }
      }
    } catch (err) {
      console.error(`  ! query failed: ${err.message}`);
    }
  }
}

async function main() {
  const connString = loadConnString();
  const client = new pg.Client({
    connectionString: connString,
    // pooler endpoints (6543) sometimes need SSL relaxation in dev
    ssl: { rejectUnauthorized: false },
  });

  console.log("Connecting to Supabase pooler…");
  await client.connect();
  console.log("Connected.");
  console.log("");
  console.log("── Applying migrations ─────────────────────────────────────────");

  let success = true;
  for (const file of MIGRATIONS) {
    try {
      await applyMigration(client, file);
    } catch {
      success = false;
      break;
    }
  }

  if (success) {
    await runVerification(client);
    console.log("");
    console.log("── Summary ─────────────────────────────────────────────────────");
    console.log(`✓ All ${MIGRATIONS.length} migrations applied successfully.`);
  } else {
    console.log("");
    console.log("── Summary ─────────────────────────────────────────────────────");
    console.error(`✗ Apply halted. Earlier files committed; failed file rolled back.`);
  }

  await client.end();
  process.exit(success ? 0 : 1);
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(2);
});
