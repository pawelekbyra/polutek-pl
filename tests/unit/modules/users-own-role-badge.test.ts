import { describe, expect, it, vi } from "vitest";
import { getOwnRoleBadge } from "@/lib/modules/users/application/get-own-role-badge";
import { passKey } from "@/lib/modules/patron-zone/infrastructure/pass-store";

const NOW = new Date("2026-11-03T12:00:00.000Z");
const DAY = 86_400_000;
const vipRow = (userId: string, provider = "STRIPE") => ({
  key: passKey(userId),
  value: JSON.stringify({
    v: 3, provider, ref: "pay_1", productId: "ACCESS_30D", priceMinor: 1499, totalMinor: 1499, currency: "PLN", method: "blik", paymentIds: ["pay_1"],
    lifetime: false, lifetimePaymentId: null, grantedAt: new Date(NOW.getTime() - 5 * DAY).toISOString(), expiresAt: new Date(NOW.getTime() + 25 * DAY).toISOString(),
    consents: { termsVersion: "t", waiverAt: NOW.toISOString() },
  }),
});

function ctxWith(opts: { channel?: boolean; rows?: Array<{ key: string; value: string }>; failVip?: boolean; disputed?: string[] }) {
  const creator = { findFirst: vi.fn(async () => (opts.channel ? { id: "c1" } : null)) };
  const appSetting = {
    findMany: vi.fn(async ({ where }: { where: { key: { in: string[] } } }) => {
      if (opts.failVip) throw new Error("db down");
      return (opts.rows ?? []).filter((row) => where.key.in.includes(row.key));
    }),
  };
  const payment = {
    findMany: vi.fn(async ({ where }: { where: { id: { in: string[] } } }) =>
      where.id.in.filter((id) => (opts.disputed ?? []).includes(id)).map((id) => ({ id, metadata: { purpose: "premium_pass", productId: "ACCESS_30D" } }))),
  };
  return { ctx: { prisma: { creator, appSetting, payment } as never, now: () => NOW }, creator, appSetting };
}

describe("getOwnRoleBadge (top bar avatar ring)", () => {
  it("a plain account is Base", async () => {
    expect(await getOwnRoleBadge(ctxWith({}).ctx, "u1")).toBe("BASE");
  });

  it("an active paid access is VIP", async () => {
    expect(await getOwnRoleBadge(ctxWith({ rows: [vipRow("u1")] }).ctx, "u1")).toBe("VIP");
  });

  it("an access whose payment is in an open or lost dispute gives no VIP ring (same rule as the comment badge)", async () => {
    expect(await getOwnRoleBadge(ctxWith({ rows: [vipRow("u1")], disputed: ["pay_1"] }).ctx, "u1")).toBe("BASE");
  });

  it("someone else's access does not count, and a simulated checkout gives no VIP", async () => {
    expect(await getOwnRoleBadge(ctxWith({ rows: [vipRow("u2")] }).ctx, "u1")).toBe("BASE");
    expect(await getOwnRoleBadge(ctxWith({ rows: [vipRow("u1", "DEMO")] }).ctx, "u1")).toBe("BASE");
  });

  it("an owner of a channel is Creator, also when VIP", async () => {
    expect(await getOwnRoleBadge(ctxWith({ channel: true }).ctx, "u1")).toBe("AUTHOR");
    expect(await getOwnRoleBadge(ctxWith({ channel: true, rows: [vipRow("u1")] }).ctx, "u1")).toBe("AUTHOR");
  });

  it("only looks at channels that are not deleted and makes exactly one lookup of each kind", async () => {
    const { ctx, creator, appSetting } = ctxWith({});
    await getOwnRoleBadge(ctx, "u1");
    expect(creator.findFirst).toHaveBeenCalledWith({ where: { userId: "u1", deletedAt: null }, select: { id: true } });
    expect(creator.findFirst).toHaveBeenCalledTimes(1);
    expect(appSetting.findMany).toHaveBeenCalledTimes(1);
  });

  it("an unreadable lookup gives no role (never calls a VIP 'Normik')", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await getOwnRoleBadge(ctxWith({ failVip: true }).ctx, "u1")).toBeNull();
    warn.mockRestore();
  });
});
