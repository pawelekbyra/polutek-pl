import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { anonymizeOldTechnicalData, TECHNICAL_DATA_RETENTION_DAYS } from "@/lib/modules/privacy";
import { pruneExpiredAuthRecords } from "@/lib/auth/prune-expired";

import { GET as retentionCron } from "@/app/api/cron/retention/route";
import { GET as pruneExpiredAuthCron } from "@/app/api/cron/prune-expired-auth/route";

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-10-04T04:15:00Z");
const ago = (days: number) => new Date(NOW.getTime() - days * DAY);

type Row = Record<string, unknown>;

/** Applies the `where` shapes the retention jobs use (lt / lte / not null / OR / in) to plain rows. */
function matches(row: Row, where: Record<string, any>): boolean {
  return Object.entries(where).every(([key, cond]) => {
    if (key === "OR") return (cond as Row[]).some((c) => matches(row, c));
    const value = row[key];
    if (cond && typeof cond === "object" && !(cond instanceof Date)) {
      if ("lt" in cond) return value instanceof Date && value < cond.lt;
      if ("lte" in cond) return value instanceof Date && value <= cond.lte;
      if ("in" in cond) return cond.in.includes(value);
      if ("not" in cond) return cond.not === null ? value !== null && value !== undefined : value !== cond.not;
    }
    return value === cond;
  });
}

function table(rows: Row[]) {
  return {
    rows,
    updateMany: async ({ where, data }: any) => {
      const hit = rows.filter((row) => matches(row, where));
      hit.forEach((row) => Object.assign(row, data));
      return { count: hit.length };
    },
    deleteMany: async ({ where }: any) => {
      const hit = rows.filter((row) => matches(row, where));
      hit.forEach((row) => rows.splice(rows.indexOf(row), 1));
      return { count: hit.length };
    },
    findMany: async ({ where }: any) => rows.filter((row) => matches(row, where)),
    findFirst: async ({ where }: any) => rows.find((row) => matches(row, where)) ?? null,
  };
}

function systemCtx(prisma: unknown) {
  return createAppContext({ actor: { type: "system", reason: "test" }, prisma: prisma as never, now: () => NOW });
}

describe(`IP addresses and browser data are cleared after ${TECHNICAL_DATA_RETENTION_DAYS} days`, () => {
  function db() {
    return {
      auditLog: table([
        { id: "old", createdAt: ago(91), ip: "203.0.113.7", userAgent: "UA", action: "AUTH_SIGN_IN" },
        { id: "new", createdAt: ago(10), ip: "203.0.113.8", userAgent: "UA", action: "AUTH_SIGN_IN" },
      ]),
      session: table([
        { id: "old", createdAt: ago(120), ipAddress: "203.0.113.7", userAgent: "UA", token: "t1" },
        { id: "new", createdAt: ago(1), ipAddress: "203.0.113.8", userAgent: "UA", token: "t2" },
      ]),
      videoPlaybackSession: table([
        { id: "old", startedAt: ago(95), ipHash: "h", userAgentHash: "u", countedAsView: true, totalWatchMs: 9000 },
        { id: "new", startedAt: ago(3), ipHash: "h2", userAgentHash: "u2", countedAsView: false, totalWatchMs: 0 },
      ]),
      videoView: table([
        { id: "old", createdAt: ago(100), ipHash: "h", videoId: "v1" },
        { id: "new", createdAt: ago(2), ipHash: "h2", videoId: "v1" },
      ]),
    };
  }

  it("clears only the personal fields of old rows; rows, counters and recent data stay", async () => {
    const prisma = db();
    const result = await anonymizeOldTechnicalData(systemCtx(prisma));

    expect(result).toEqual({ ok: true, data: { cutoff: ago(90).toISOString(), auditLogs: 1, sessions: 1, playbackSessions: 1, views: 1 } });
    expect(prisma.auditLog.rows).toEqual([
      { id: "old", createdAt: ago(91), ip: null, userAgent: null, action: "AUTH_SIGN_IN" },
      { id: "new", createdAt: ago(10), ip: "203.0.113.8", userAgent: "UA", action: "AUTH_SIGN_IN" },
    ]);
    expect(prisma.session.rows[0]).toMatchObject({ ipAddress: null, userAgent: null, token: "t1" });
    expect(prisma.session.rows[1]).toMatchObject({ ipAddress: "203.0.113.8" });
    // The counted view stays counted; only the hashes go.
    expect(prisma.videoPlaybackSession.rows[0]).toMatchObject({ ipHash: null, userAgentHash: null, countedAsView: true, totalWatchMs: 9000 });
    expect(prisma.videoPlaybackSession.rows[1]).toMatchObject({ ipHash: "h2" });
    expect(prisma.videoView.rows).toHaveLength(2);
    expect(prisma.videoView.rows[0]).toMatchObject({ ipHash: null, videoId: "v1" });
  });

  it("is idempotent", async () => {
    const prisma = db();
    await anonymizeOldTechnicalData(systemCtx(prisma));
    const again = await anonymizeOldTechnicalData(systemCtx(prisma));
    expect(again).toMatchObject({ ok: true, data: { auditLogs: 0, sessions: 0, playbackSessions: 0, views: 0 } });
  });

  it("runs only as a system job", async () => {
    const result = await anonymizeOldTechnicalData(createAppContext({ actor: { type: "admin", userId: "a" }, prisma: db() as never }));
    expect(result.ok).toBe(false);
  });
});

describe("expired sign-in sessions and e-mail tokens are deleted", () => {
  it("deletes only what has expired", async () => {
    const prisma = {
      session: table([{ id: "gone", expiresAt: ago(1) }, { id: "live", expiresAt: new Date(NOW.getTime() + DAY) }]),
      verification: table([{ id: "gone", expiresAt: new Date(NOW.getTime() - 1000) }, { id: "live", expiresAt: new Date(NOW.getTime() + 60_000) }]),
    };
    const result = await pruneExpiredAuthRecords({ now: NOW, db: prisma as never });
    expect(result).toEqual({ sessionsDeleted: 1, verificationsDeleted: 1, expiredBefore: NOW.toISOString() });
    expect(prisma.session.rows.map((r) => r.id)).toEqual(["live"]);
    expect(prisma.verification.rows.map((r) => r.id)).toEqual(["live"]);
  });
});

describe("cron routes", () => {
  afterEach(() => vi.unstubAllEnvs());

  it.each([["retention", retentionCron], ["prune-expired-auth", pruneExpiredAuthCron]] as const)("/api/cron/%s rejects calls without the cron secret", async (name, GET) => {
    vi.stubEnv("CRON_SECRET", "test_cron_secret_test_cron_secret");
    const res = await GET(new NextRequest(`http://localhost/api/cron/${name}`, { headers: { Authorization: "Bearer nope" } }));
    expect(res.status).toBe(401);
    vi.stubEnv("CRON_SECRET", "");
    const unset = await GET(new NextRequest(`http://localhost/api/cron/${name}`, { headers: { Authorization: "Bearer " } }));
    expect(unset.status).toBe(401);
  });
});
