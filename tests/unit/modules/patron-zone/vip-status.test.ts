import { describe, expect, it, vi } from "vitest";
import { isVipRecord, listVipUserIds } from "@/lib/modules/patron-zone/application/vip-status";
import type { PassRecord } from "@/lib/modules/patron-zone";
import { passKey } from "@/lib/modules/patron-zone/infrastructure/pass-store";

const NOW = new Date("2026-11-02T12:00:00.000Z");
const DAY = 86_400_000;

function record(overrides: Partial<PassRecord> = {}): PassRecord {
  return {
    v: 3,
    provider: "STRIPE",
    ref: "pay_1",
    productId: "ACCESS_30D",
    priceMinor: 1499,
    totalMinor: 1499,
    currency: "PLN",
    method: "blik",
    paymentIds: ["pay_1"],
    lifetime: false,
    lifetimePaymentId: null,
    grantedAt: new Date(NOW.getTime() - 5 * DAY).toISOString(),
    expiresAt: new Date(NOW.getTime() + 25 * DAY).toISOString(),
    consents: { termsVersion: "t", waiverAt: NOW.toISOString() },
    ...overrides,
  };
}

function fakeDb(rows: Array<{ key: string; value: string }>) {
  const findMany = vi.fn(async ({ where }: { where: { key: { in: string[] } } }) => rows.filter((row) => where.key.in.includes(row.key)));
  return { db: { appSetting: { findMany } } as never, findMany };
}
const row = (userId: string, value: unknown) => ({ key: passKey(userId), value: typeof value === "string" ? value : JSON.stringify(value) });

describe("isVipRecord (paid, active patron-zone access only)", () => {
  it("an active 30-day paid access is VIP", () => {
    expect(isVipRecord(record(), NOW)).toBe(true);
  });

  it("a 30-day access that ended is not VIP (expiry is computed on every read)", () => {
    expect(isVipRecord(record({ expiresAt: new Date(NOW.getTime() - 1000).toISOString() }), NOW)).toBe(false);
    expect(isVipRecord(record({ expiresAt: NOW.toISOString() }), NOW)).toBe(false);
  });

  it("an unlimited access stays VIP for good", () => {
    const life = record({ productId: "ACCESS_LIFETIME", lifetime: true, lifetimePaymentId: "pay_1", expiresAt: null });
    expect(isVipRecord(life, NOW)).toBe(true);
    expect(isVipRecord(life, new Date("2099-01-01T00:00:00.000Z"))).toBe(true);
  });

  it("a simulated (DEMO) checkout moved no money and gives no badge", () => {
    expect(isVipRecord(record({ provider: "DEMO" }), NOW)).toBe(false);
  });

  it("no record is not VIP", () => {
    expect(isVipRecord(null, NOW)).toBe(false);
  });
});

describe("listVipUserIds", () => {
  it("reads every author of a page with ONE query (no N+1) and returns only the VIP ids", async () => {
    const { db, findMany } = fakeDb([
      row("active", record()),
      row("expired", record({ expiresAt: new Date(NOW.getTime() - DAY).toISOString() })),
      row("life", record({ productId: "ACCESS_LIFETIME", lifetime: true, expiresAt: null })),
      row("demo", record({ provider: "DEMO" })),
    ]);
    const ids = Array.from({ length: 40 }, (_, i) => `user_${i}`).concat(["active", "expired", "life", "demo", "active"]);

    const vip = await listVipUserIds(db, ids, NOW);

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany.mock.calls[0][0].where.key.in).toHaveLength(44);
    expect([...vip].sort()).toEqual(["active", "life"]);
  });

  it("asks for nothing when there are no authors", async () => {
    const { db, findMany } = fakeDb([]);
    expect((await listVipUserIds(db, [], NOW)).size).toBe(0);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("splits a huge input into a few queries, never one per author", async () => {
    const { db, findMany } = fakeDb([row("user_900", record())]);
    const ids = Array.from({ length: 1200 }, (_, i) => `user_${i}`);
    const vip = await listVipUserIds(db, ids, NOW);
    expect(findMany).toHaveBeenCalledTimes(3);
    expect([...vip]).toEqual(["user_900"]);
  });

  it("bad or foreign JSON is simply not VIP, never an exception", async () => {
    const { db } = fakeDb([row("junk", "not json"), row("other", { v: 9 }), row("ok", record())]);
    expect([...(await listVipUserIds(db, ["junk", "other", "ok"], NOW))]).toEqual(["ok"]);
  });

  it("exposes nothing but account ids (no date, product, price or method)", async () => {
    const { db } = fakeDb([row("ok", record())]);
    const vip = await listVipUserIds(db, ["ok"], NOW);
    expect(vip).toBeInstanceOf(Set);
    expect(JSON.stringify([...vip])).toBe('["ok"]');
  });
});
