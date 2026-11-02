import { afterEach, describe, expect, it, vi } from "vitest";
import { VAT_STATUS_DEFAULT, getVatStatus, isVatExempt, parseVatStatus, vatRatePercentFor } from "@/lib/config/vat";
import { buildPremiumPassOffer } from "@/lib/modules/patron-zone/domain/offer";
import { PATRON_PRICES } from "@/lib/modules/patron-zone/domain/config";

afterEach(() => vi.unstubAllEnvs());

describe("VAT status (lib/config/vat.ts)", () => {
  it("defaults to exempt; an unknown or empty value means the default", () => {
    expect(VAT_STATUS_DEFAULT).toBe("exempt");
    expect(getVatStatus()).toBe("exempt");
    expect(isVatExempt()).toBe(true);
    for (const raw of [undefined, null, "", " ", "yes", "23"]) expect(parseVatStatus(raw)).toBe("exempt");
  });

  it("reads the build-time variable (case and spaces are tolerated)", () => {
    vi.stubEnv("NEXT_PUBLIC_PLATFORM_VAT_STATUS", " Active ");
    expect(getVatStatus()).toBe("active");
    expect(isVatExempt()).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_PLATFORM_VAT_STATUS", "exempt");
    expect(getVatStatus()).toBe("exempt");
  });

  it("the offer reports 0% when exempt and 23% when active, and the amounts are identical in both modes", () => {
    const exempt = buildPremiumPassOffer({ signedIn: true, premiumCount: 2 });
    vi.stubEnv("NEXT_PUBLIC_PLATFORM_VAT_STATUS", "active");
    const active = buildPremiumPassOffer({ signedIn: true, premiumCount: 2 });
    expect(exempt.vatRatePercent).toBe(0);
    expect(active.vatRatePercent).toBe(23);
    expect(vatRatePercentFor("exempt")).toBe(0);
    expect(vatRatePercentFor("active")).toBe(23);
    expect(active.products).toEqual(exempt.products);
    expect(exempt.products.map((p) => p.prices)).toEqual([PATRON_PRICES.ACCESS_30D, PATRON_PRICES.ACCESS_LIFETIME]);
    expect(PATRON_PRICES.ACCESS_30D.PLN).toBe(1499);
    expect(PATRON_PRICES.ACCESS_LIFETIME.PLN).toBe(2999);
  });
});
