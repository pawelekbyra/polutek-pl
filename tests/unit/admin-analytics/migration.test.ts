import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { STARTUP_EDGES_MS } from "@/lib/modules/admin-analytics";

const sql = fs.readFileSync(path.join(process.cwd(), "prisma/migrations/20261005120000_analytics_rollups/migration.sql"), "utf8");
const code = sql.replace(/--.*$/gm, "");

describe("analytics rollup migration (static review)", () => {
  it("is additive: no DROP, TRUNCATE, ALTER COLUMN or DROP COLUMN, and every table is IF NOT EXISTS", () => {
    expect(code).not.toMatch(/\bDROP\s+(TABLE|COLUMN|SCHEMA|FUNCTION)\b/i);
    expect(code).not.toMatch(/\bTRUNCATE\b/i);
    expect(code).not.toMatch(/ALTER\s+TABLE/i);
    const creates = [...code.matchAll(/CREATE TABLE (IF NOT EXISTS )?/g)];
    expect(creates.length).toBeGreaterThanOrEqual(8);
    expect(creates.every((m) => m[1])).toBe(true);
    for (const m of code.matchAll(/CREATE INDEX (IF NOT EXISTS )?/g)) expect(m[1]).toBeTruthy();
  });

  it("the histogram edges in SQL equal the ones the panel reads with", () => {
    const m = code.match(/width_bucket\(v\.x::double precision, ARRAY\[([^\]]+)\]/);
    expect(m).not.toBeNull();
    expect(m![1].split(",").map((x) => Number(x.trim()))).toEqual([...STARTUP_EDGES_MS]);
    expect(code).toContain("generate_series(0, 12)");
  });

  it("wraps rollup_day idempotently (guarded rename) and re-grants EXECUTE", () => {
    expect(code).toContain("to_regprocedure('telemetry.rollup_day_core(date)') IS NULL");
    expect(code).toContain("PERFORM telemetry.rollup_day_core(p_day)");
    expect(code).toContain("PERFORM telemetry.rollup_analytics_day(p_day)");
    expect(code).toMatch(/GRANT EXECUTE ON FUNCTION telemetry\.rollup_day\(date\) TO pp_collector/);
  });

  it("never lets the read-only role see the salt or write anything", () => {
    expect(code).toContain("REVOKE ALL ON telemetry.daily_salt FROM pp_analytics_ro");
    expect(code).not.toMatch(/GRANT\s+(INSERT|UPDATE|DELETE)[^;]*pp_analytics_ro/i);
  });

  it("every rollup deletes before inserting (idempotent) and uses Warsaw days / UTC hours", () => {
    expect(code).toContain("'Europe/Warsaw'");
    expect(code).toContain("date_trunc('hour', pv.ts, 'UTC')");
    const deletes = [...code.matchAll(/DELETE FROM telemetry\.(r_\w+) WHERE (day|hour) (=|>=)/g)].map((m) => m[1]);
    for (const t of ["r_traffic_hourly", "r_traffic_extra_daily", "r_video_hourly", "r_video_qoe_daily", "r_playback_total_daily", "r_playback_error_daily", "r_playback_ladder_daily"]) expect(deletes).toContain(t);
  });
});
