/**
 * Seed script: imports all JSON reports from ./supabase/seeds/starting_reports
 * via the admin imports API endpoint.
 *
 * Usage:
 *   ADMIN_BEARER_TOKEN=ey... node scripts/seed-starting-reports.mjs
 *   # optional overrides:
 *   ADMIN_BEARER_TOKEN=ey... SEED_DIR=./supabase/seeds/starting_reports API_URL=http://localhost:4321/api/admin/imports node scripts/seed-starting-reports.mjs
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const FILENAME_REGEX = /^\d{4}-\d{2}-\d{2}report\.json$/;
const DEFAULT_DIR = process.env.SEED_DIR || "./supabase/seeds/starting_reports";
const API_URL = process.env.API_URL || "http://localhost:4321/api/admin/imports";
const TOKEN = process.env.ADMIN_BEARER_TOKEN || "";
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_KEY || "";

if (!TOKEN) {
  console.error("Missing ADMIN_BEARER_TOKEN env var. Provide a valid admin user's access token.");
  process.exit(1);
}

/**
 * Import a single file by sending application/json body to the admin imports endpoint.
 * Prefer JSON body over multipart to keep it simple and auditable.
 */
async function importReportJson(filename, payload) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({ filename, payload }),
  });

  let body;
  const text = await response.text();
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }

  return { ok: response.ok, status: response.status, body };
}

/**
 * Fallback: call RPC directly using Supabase client with Authorization header.
 * Requires SUPABASE_URL and SUPABASE_KEY to be set in env.
 */
async function importReportRpc(filename, payload) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return {
      ok: false,
      status: 0,
      body: { code: "missing_env", message: "SUPABASE_URL and SUPABASE_KEY are required for RPC fallback" },
    };
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    global: {
      headers: { authorization: `Bearer ${TOKEN}` },
    },
  });

  const { data, error } = await supabase.rpc("admin_import_report", {
    payload,
    filename,
  });

  if (error) {
    return { ok: false, status: 500, body: { code: "rpc_error", message: error.message } };
  }

  return { ok: true, status: 201, body: data };
}

/**
 * Final fallback: insert directly into weekly_reports and stock_picks as admin user.
 * Generates a slug: "<YYYY-MM-DD>-us-market-report".
 */
async function importReportDirectInsert(filename, payload) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return {
      ok: false,
      status: 0,
      body: { code: "missing_env", message: "SUPABASE_URL and SUPABASE_KEY are required for direct insert" },
    };
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    global: {
      headers: { authorization: `Bearer ${TOKEN}` },
    },
  });

  const pubDate = String(payload.published_at ?? "").slice(0, 10);
  const slug = `${pubDate}-us-market-report`.toLowerCase();

  // Upsert weekly report
  const reportRow = {
    report_id: payload.report_id,
    published_at: payload.published_at,
    version: payload.version ?? "v1",
    source_checksum: payload.source_checksum ?? null,
    title: payload.title,
    summary: payload.summary,
    slug,
  };

  const { error: reportErr } = await supabase.from("weekly_reports").upsert(reportRow, { onConflict: "report_id" });
  if (reportErr) {
    return { ok: false, status: 500, body: { code: "insert_error", message: reportErr.message } };
  }

  // Upsert picks (use composite unique (report_id, ticker, side))
  const picks = Array.isArray(payload.picks) ? payload.picks : [];
  for (const p of picks) {
    const pickRow = {
      pick_id: p.pick_id,
      report_id: payload.report_id,
      ticker: p.ticker,
      exchange: p.exchange,
      side: p.side,
      target_change_pct: p.target_change_pct,
      rationale: p.rationale,
    };
    const { error: pickErr } = await supabase.from("stock_picks").upsert(pickRow, {
      onConflict: "report_id,ticker,side",
    });
    if (pickErr) {
      return { ok: false, status: 500, body: { code: "insert_error", message: pickErr.message } };
    }
  }

  // Try to refresh materialized view (best-effort)
  await supabase.rpc("refresh_picks_history").catch(() => {});

  return { ok: true, status: 201, body: { status: "success", report_id: payload.report_id, report_slug: slug } };
}

async function main() {
  console.log(`Seeding reports from: ${DEFAULT_DIR}`);
  console.log(`API endpoint: ${API_URL}`);
  if (SUPABASE_URL && SUPABASE_KEY) {
    console.log(`RPC fallback enabled (SUPABASE_URL detected).`);
  }

  const files = await readdir(DEFAULT_DIR, { withFileTypes: true });
  const candidates = files
    .filter((f) => f.isFile() && FILENAME_REGEX.test(f.name) && f.name.endsWith(".json"))
    .map((f) => f.name)
    .sort();

  if (candidates.length === 0) {
    console.log("No matching *.json files found. Expected names like YYYY-MM-DDreport.json");
    return;
  }

  let successCount = 0;
  let failCount = 0;

  for (const name of candidates) {
    const fullPath = join(DEFAULT_DIR, name);
    try {
      const content = await readFile(fullPath, "utf8");
      const payload = JSON.parse(content);
      let res = await importReportJson(name, payload);
      if (!res.ok && (res.status === 401 || res.status === 403)) {
        // Fallback to RPC if unauthorized via API and env present
        res = await importReportRpc(name, payload);
      }
      if (!res.ok && res.body && res.body.code === "rpc_error") {
        // Last resort: direct insert as admin user with RLS
        res = await importReportDirectInsert(name, payload);
      }
      if (res.ok) {
        successCount += 1;
        console.log(`[OK] ${name} ->`, res.body);
      } else {
        failCount += 1;
        console.warn(`[FAIL] ${name} (status ${res.status}) ->`, res.body);
      }
    } catch (err) {
      failCount += 1;
      console.error(`[ERROR] ${name}:`, err.message);
    }
  }

  console.log(`Done. Success: ${successCount}, Failed: ${failCount}`);
  if (failCount > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
