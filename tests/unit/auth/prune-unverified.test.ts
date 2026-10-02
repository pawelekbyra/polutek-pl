import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const prisma = vi.hoisted(() => ({ user: { deleteMany: vi.fn() } }));
vi.mock("@/lib/prisma", () => ({ prisma }));

import { pruneUnverifiedAccounts, UNVERIFIED_ACCOUNT_RETENTION_DAYS } from "@/lib/auth/prune-unverified";
import { GET } from "@/app/api/cron/prune-unverified-accounts/route";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "test_cron_secret";
  prisma.user.deleteMany.mockResolvedValue({ count: 3 });
});

describe("pruneUnverifiedAccounts (F-04)", () => {
  it("only deletes old, never-verified plain users that own nothing", async () => {
    const now = new Date("2026-10-10T00:00:00.000Z");
    const result = await pruneUnverifiedAccounts({ now });
    expect(result.deletedCount).toBe(3);
    const where = prisma.user.deleteMany.mock.calls[0][0].where;
    expect(where).toMatchObject({
      emailVerified: false,
      isDeleted: false,
      role: "USER",
      stripeCustomerId: null,
      payments: { none: {} },
      patronGrants: { none: {} },
      creators: { none: {} },
      comments: { none: {} },
    });
    expect(where.createdAt.lt.toISOString()).toBe(
      new Date(now.getTime() - UNVERIFIED_ACCOUNT_RETENTION_DAYS * 86400_000).toISOString(),
    );
  });
});

describe("GET /api/cron/prune-unverified-accounts", () => {
  const request = (auth?: string) =>
    new NextRequest("http://localhost/api/cron/prune-unverified-accounts", { headers: auth ? { Authorization: auth } : {} });

  it("fails closed without the secret", async () => {
    expect((await GET(request())).status).toBe(401);
    expect((await GET(request("Bearer wrong-secret-xx"))).status).toBe(401);
    delete process.env.CRON_SECRET;
    expect((await GET(request("Bearer undefined"))).status).toBe(401);
    expect(prisma.user.deleteMany).not.toHaveBeenCalled();
  });

  it("runs the prune with the right secret", async () => {
    const res = await GET(request("Bearer test_cron_secret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ deletedCount: 3 });
  });
});
