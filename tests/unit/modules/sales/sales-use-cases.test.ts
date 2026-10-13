import { describe, expect, it, vi } from "vitest";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { quoteVideoPurchase, recordOrderPaid, refundOrder, setVideoPrice } from "@/lib/modules/sales";

const CREATOR = { id: "c1", userId: "owner", status: "ACTIVE", members: [{ userId: "owner", role: "OWNER" }] };
const ON = { PLATFORM_GATE_SALES: "on" };
const OFF = {};

function makePrisma(over: Record<string, unknown> = {}) {
  const tx = {
    order: { create: vi.fn(async () => ({ id: "o1" })), updateMany: vi.fn(async () => ({ count: 1 })) },
    entitlement: { upsert: vi.fn(async () => ({})), updateMany: vi.fn(async () => ({ count: 1 })) },
    ledgerEntry: { create: vi.fn(async () => ({})) },
    videoPrice: { upsert: vi.fn(async () => ({})) },
    video: { update: vi.fn(async () => ({})) },
    auditLog: { create: vi.fn(async () => ({})) },
  };
  const prisma = {
    order: { findUnique: vi.fn(async () => null) },
    video: { findUnique: vi.fn(async () => ({ id: "v1", creatorId: "c1", creator: CREATOR, tier: "PAID", status: "PUBLISHED", price: { currency: "PLN", amountMinor: 2000, payWhatYouWant: false, minAmountMinor: null } })) },
    entitlement: { findFirst: vi.fn(async () => null) },
    creator: { findUnique: vi.fn(async () => ({ id: "c1", userId: "owner", status: "ACTIVE", members: [{ userId: "owner", role: "OWNER" }] })) },
    $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx),
    ...over,
  };
  return { prisma, tx };
}

const ctx = (actor: { type: string; [k: string]: unknown }, prisma: unknown) => createAppContext({ actor: actor as never, prisma: prisma as never });
const system = { type: "system", reason: "stripe-webhook" };
const staff = { type: "admin", userId: "admin1" };
const owner = { type: "user", userId: "owner" };
const buyer = { type: "user", userId: "buyer" };

describe("sales gate", () => {
  it("refuses everything while the gate is off", async () => {
    const { prisma } = makePrisma();
    const c = ctx(owner, prisma);
    expect((await setVideoPrice(c, { videoId: "v1", currency: "PLN", amountMinor: 1000, payWhatYouWant: false }, OFF)).ok).toBe(false);
    expect((await quoteVideoPurchase(ctx(buyer, prisma), { videoId: "v1", vatRateBp: 2300 }, OFF)).ok).toBe(false);
    expect((await recordOrderPaid(ctx(system, prisma), { userId: "buyer", videoId: "v1", currency: "PLN", grossMinor: 2000, vatRateBp: 2300, providerRef: "p1" }, OFF)).ok).toBe(false);
    expect((await refundOrder(ctx(staff, prisma), { orderId: "o1", amountMinor: 100, reason: "powod testowy" }, { issueRefund: vi.fn() }, OFF)).ok).toBe(false);
  });
});

describe("setVideoPrice", () => {
  it("lets the owner price a video and audits it", async () => {
    const { prisma, tx } = makePrisma({ video: { findUnique: vi.fn(async () => ({ id: "v1", creatorId: "c1", creator: CREATOR, tier: "PUBLIC" })) } });
    const res = await setVideoPrice(ctx(owner, prisma), { videoId: "v1", currency: "pln", amountMinor: 1500, payWhatYouWant: false }, ON);
    expect(res.ok).toBe(true);
    expect(tx.video.update).toHaveBeenCalledWith({ where: { id: "v1" }, data: { tier: "PAID" } });
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
  });

  it("denies a stranger and platform staff", async () => {
    const { prisma } = makePrisma();
    const stranger = await setVideoPrice(ctx({ type: "user", userId: "someone" }, prisma), { videoId: "v1", currency: "PLN", amountMinor: 1500, payWhatYouWant: false }, ON);
    expect(stranger.ok).toBe(false);
    const asStaff = await setVideoPrice(ctx(staff, prisma), { videoId: "v1", currency: "PLN", amountMinor: 1500, payWhatYouWant: false }, ON);
    expect(asStaff.ok).toBe(false);
  });

  it("rejects prices below 1.00 and unknown currencies", async () => {
    const { prisma } = makePrisma();
    expect((await setVideoPrice(ctx(owner, prisma), { videoId: "v1", currency: "PLN", amountMinor: 50, payWhatYouWant: false }, ON)).ok).toBe(false);
    expect((await setVideoPrice(ctx(owner, prisma), { videoId: "v1", currency: "XXX", amountMinor: 1500, payWhatYouWant: false }, ON)).ok).toBe(false);
  });
});

describe("recordOrderPaid", () => {
  const input = { userId: "buyer", videoId: "v1", currency: "PLN", grossMinor: 12_300, vatRateBp: 2300, providerRef: "pi_1" };

  it("books order, entitlement and ledger in one go", async () => {
    const { prisma, tx } = makePrisma();
    const res = await recordOrderPaid(ctx(system, prisma), input, { ...ON, PLATFORM_FEE_BP: "1000" });
    expect(res).toEqual({ ok: true, data: { orderId: "o1", replayed: false } });
    const order = (tx.order.create.mock.calls[0][0] as { data: Record<string, number | string> }).data;
    expect(order).toMatchObject({ grossMinor: 12_300, vatMinor: 2300, netMinor: 10_000, platformFeeMinor: 1000, creatorShareMinor: 9000, status: "PAID" });
    expect((tx.ledgerEntry.create.mock.calls[0][0] as { data: { amountMinor: number } }).data.amountMinor).toBe(9000);
    expect(tx.entitlement.upsert).toHaveBeenCalledTimes(1);
  });

  it("is a no-op for a replayed notification", async () => {
    const { prisma, tx } = makePrisma({ order: { findUnique: vi.fn(async () => ({ id: "o-old" })) } });
    const res = await recordOrderPaid(ctx(system, prisma), input, ON);
    expect(res).toEqual({ ok: true, data: { orderId: "o-old", replayed: true } });
    expect(tx.order.create).not.toHaveBeenCalled();
  });

  it("is only for the system actor", async () => {
    const { prisma } = makePrisma();
    expect((await recordOrderPaid(ctx(buyer, prisma), input, ON)).ok).toBe(false);
    expect((await recordOrderPaid(ctx(staff, prisma), input, ON)).ok).toBe(false);
  });
});

describe("refundOrder", () => {
  const order = { id: "o1", channelId: "c1", currency: "PLN", providerRef: "pi_1", status: "PAID", grossMinor: 1000, refundedMinor: 0, creatorShareMinor: 700 };

  it("asks the provider first and revokes the entitlement on a full refund", async () => {
    const { prisma, tx } = makePrisma({ order: { findUnique: vi.fn(async () => order) } });
    const issueRefund = vi.fn(async () => undefined);
    const res = await refundOrder(ctx(staff, prisma), { orderId: "o1", amountMinor: 1000, reason: "klient poprosił" }, { issueRefund }, ON);
    expect(res).toEqual({ ok: true, data: { status: "REFUNDED" } });
    expect(issueRefund).toHaveBeenCalledTimes(1);
    expect((tx.ledgerEntry.create.mock.calls[0][0] as { data: { amountMinor: number } }).data.amountMinor).toBe(-700);
    expect(tx.entitlement.updateMany).toHaveBeenCalledTimes(1);
  });

  it("leaves the books untouched when the provider refuses", async () => {
    const { prisma, tx } = makePrisma({ order: { findUnique: vi.fn(async () => order) } });
    const res = await refundOrder(ctx(staff, prisma), { orderId: "o1", amountMinor: 500, reason: "klient poprosił" }, { issueRefund: vi.fn(async () => { throw new Error("boom"); }) }, ON);
    expect(res.ok).toBe(false);
    expect(tx.order.updateMany).not.toHaveBeenCalled();
    expect(tx.ledgerEntry.create).not.toHaveBeenCalled();
  });

  it("rejects an amount above what is left and a missing reason", async () => {
    const { prisma } = makePrisma({ order: { findUnique: vi.fn(async () => ({ ...order, refundedMinor: 800 })) } });
    const issueRefund = vi.fn();
    expect((await refundOrder(ctx(staff, prisma), { orderId: "o1", amountMinor: 300, reason: "klient poprosił" }, { issueRefund }, ON)).ok).toBe(false);
    expect((await refundOrder(ctx(staff, prisma), { orderId: "o1", amountMinor: 100, reason: "" }, { issueRefund }, ON)).ok).toBe(false);
    expect(issueRefund).not.toHaveBeenCalled();
  });

  it("is not available to a plain user", async () => {
    const { prisma } = makePrisma({ order: { findUnique: vi.fn(async () => order) } });
    expect((await refundOrder(ctx(buyer, prisma), { orderId: "o1", amountMinor: 100, reason: "klient poprosił" }, { issueRefund: vi.fn() }, ON)).ok).toBe(false);
  });
});
