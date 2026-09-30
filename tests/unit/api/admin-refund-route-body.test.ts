import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const adminRefund = vi.fn();

vi.mock("@/lib/auth-utils", () => ({
  requireAdminForApi: vi.fn().mockResolvedValue({ adminUserId: "admin_1", response: null }),
}));
vi.mock("@/lib/modules/shared/app-context", () => ({ createAppContext: vi.fn(() => ({})) }));
vi.mock("@/lib/modules/payments", () => ({ adminRefund: (...a: unknown[]) => adminRefund(...a) }));

import { POST } from "@/app/api/admin/payments/[id]/refund/route";

const call = (body?: string) =>
  POST(new NextRequest("http://localhost/api/admin/payments/p1/refund", { method: "POST", body }), {
    params: Promise.resolve({ id: "p1" }),
  });

describe("POST /api/admin/payments/[id]/refund body handling", () => {
  beforeEach(() => {
    adminRefund.mockReset();
    adminRefund.mockResolvedValue({ ok: true, data: { refunded: true } });
  });

  it("returns 400 and does not refund on a truncated body", async () => {
    const res = await call('{"amountMinor": 50');
    expect(res.status).toBe(400);
    expect(adminRefund).not.toHaveBeenCalled();
  });

  it("an empty body is still a full refund", async () => {
    const res = await call();
    expect(res.status).toBe(200);
    expect(adminRefund).toHaveBeenCalledWith({ paymentId: "p1", amountMinor: undefined, reason: undefined }, expect.anything());
  });

  it("a valid partial amount is passed through", async () => {
    await call('{"amountMinor":500}');
    expect(adminRefund.mock.calls[0][0].amountMinor).toBe(500);
  });
});
