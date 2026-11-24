import { beforeEach, describe, expect, it, vi } from "vitest";

// Minimum tip per currency (Ustawienia -> Płatności): the Polish messages must survive the Zod 4 migration
// (v3 `invalid_type_error` is gone; the schema sets `error` instead), and a bad amount never reaches the use case.
const m = vi.hoisted(() => ({
  openGate: vi.fn(async () => ({ ok: true as const, viewer: { userId: "adm1" }, ctx: {} })),
  updatePaymentSettings: vi.fn(async () => ({ ok: true as const, data: undefined })),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@admin/lib/actions/gate", () => ({ openGate: m.openGate }));
vi.mock("@/lib/modules/payments", () => ({ updatePaymentSettings: m.updatePaymentSettings }));
vi.mock("@/lib/modules/channel", () => ({ changeChannelOwner: vi.fn(), findChannelOwnerCandidates: vi.fn(), resyncSubscribers: vi.fn(), updateAdminChannelSettings: vi.fn() }));
vi.mock("@/lib/modules/admin-content", () => ({ removeDefaultThumbnail: vi.fn() }));
vi.mock("@/lib/modules/admin-overview", () => ({
  resetAlertThresholds: vi.fn(),
  saveAlertThresholds: vi.fn(),
  THRESHOLD_FIELDS: [],
  ThresholdValidationError: class extends Error {},
  warsawOffsetMinutes: () => 60,
}));

import { savePaymentLimitsAction } from "@admin/app/(panel)/ustawienia/actions";
import { SUPPORTED_CURRENCIES } from "@/lib/constants";

function form(over: Record<string, string> = {}) {
  const fd = new FormData();
  for (const c of SUPPORTED_CURRENCIES) fd.set(c, over[c] ?? "5");
  return fd;
}

beforeEach(() => vi.clearAllMocks());

describe("savePaymentLimitsAction (Zod 4 messages)", () => {
  it("accepts amounts with a comma and saves every currency", async () => {
    const r = await savePaymentLimitsAction(null, form({ PLN: "10,50" }));
    expect(r.ok).toBe(true);
    expect(m.updatePaymentSettings).toHaveBeenCalledWith({ limits: expect.arrayContaining([{ currency: "PLN", minAmount: 10.5 }]) }, expect.anything());
  });

  it.each([
    ["abc", "Podaj kwotę, np. 10 albo 10,50."],
    ["Infinity", "Podaj kwotę, np. 10 albo 10,50."],
    ["", "Minimum to 1."],
    ["0,5", "Minimum to 1."],
    ["1,234", "Najwyżej dwa miejsca po przecinku."],
  ])("refuses %j with the Polish field message", async (value, message) => {
    const r = await savePaymentLimitsAction(null, form({ PLN: value }));
    expect(r).toMatchObject({ ok: false, message: "Popraw zaznaczone kwoty.", fieldErrors: { PLN: message } });
    expect(m.updatePaymentSettings).not.toHaveBeenCalled();
  });
});
