import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ChannelRole, ChannelStatus } from "@prisma/client";
import { CHANNEL_ROLES, CHANNEL_STATUSES } from "@/lib/modules/authz";

const MIGRATION = path.join(process.cwd(), "prisma/migrations/20261013120000_multi_channel_schema/migration.sql");
const sql = fs.readFileSync(MIGRATION, "utf8");

describe("authz domain constants match the Prisma enums", () => {
  it("channel roles", () => {
    expect([...CHANNEL_ROLES].sort()).toEqual(Object.values(ChannelRole).sort());
  });

  it("channel statuses", () => {
    expect([...CHANNEL_STATUSES].sort()).toEqual(Object.values(ChannelStatus).sort());
  });
});

describe("multi-channel migration (CLAUDE.md 4.0: additive, idempotent backfill)", () => {
  it("has no BOM", () => {
    const bytes = fs.readFileSync(MIGRATION);
    expect(bytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))).toBe(false);
  });

  it("does not drop, rename, retype or tighten anything that exists", () => {
    const destructive = [/\bDROP\s+TABLE\b/i, /\bDROP\s+COLUMN\b/i, /\bDROP\s+TYPE\b/i, /\bRENAME\b/i, /\bALTER\s+COLUMN\b/i, /\bTRUNCATE\b/i, /\bDELETE\s+FROM\b/i];
    for (const pattern of destructive) expect(sql, String(pattern)).not.toMatch(pattern);
  });

  it("adds every new column on an existing table as nullable or with a default", () => {
    const alterBlocks = sql.match(/ALTER TABLE "[A-Za-z]+" ADD COLUMN[^;]+;/g) ?? [];
    expect(alterBlocks.length).toBeGreaterThan(0);
    for (const block of alterBlocks) {
      for (const column of block.split(/ADD COLUMN/).slice(1)) {
        const definition = column.replace(/,\s*$/, "").trim();
        const notNullWithoutDefault = /NOT NULL/i.test(definition) && !/DEFAULT/i.test(definition);
        expect(notNullWithoutDefault, definition).toBe(false);
      }
    }
  });

  it("guards handle uniqueness case-insensitively and keeps decisions append-only", () => {
    expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS "Creator_handle_lower_key" ON "Creator" (lower("handle"))');
    expect(sql).toMatch(/BEFORE UPDATE OR DELETE ON "ModerationDecision"/);
  });

  it("backfills owners idempotently", () => {
    expect(sql).toMatch(/INSERT INTO "ChannelMember"[\s\S]+ON CONFLICT \("channelId", "userId"\) DO NOTHING/);
    expect(sql).toMatch(/WHERE c\."handle" IS NULL/);
    expect(sql).toMatch(/j\."channelId" IS NULL/);
  });
});
