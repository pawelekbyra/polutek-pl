// experiment: premium-pass (docs/experiments/premium-pass.md)
import { describe, expect, it } from "vitest";
import {
  DEFAULT_PREMIUM_SLUGS,
  isPremiumPassVideo,
  isPremiumPassVideoForEveryone,
  PASS_PRODUCTS,
  parsePremiumPassMode,
  premiumPassFor,
  readPremiumPassConfig,
} from "@/lib/modules/experiment-premium-pass";
import { formatPassPrice, readPremiumPassOffer, buildPremiumPassOffer } from "@/lib/modules/experiment-premium-pass/domain/offer";
import { maskEmail, newDemoRef, parseDemoPassRecord, passStateOf } from "@/lib/modules/experiment-premium-pass/domain/pass-state";

const now = new Date("2026-10-21T10:00:00.000Z");
const live = { slug: "jj", status: "PUBLISHED", isMainFeatured: false, premiereAt: null };

describe("premium-pass switch", () => {
  it("is off for a missing, empty or unknown value", () => {
    for (const value of [undefined, "", "on", "true", "1", "everyone"]) expect(parsePremiumPassMode(value)).toBe("off");
    expect(readPremiumPassConfig({})).toBeNull();
    expect(readPremiumPassConfig({ PREMIUM_PASS_EXPERIMENT: "yes" })).toBeNull();
  });

  it("accepts testers and all, case-insensitive", () => {
    expect(parsePremiumPassMode("testers")).toBe("testers");
    expect(parsePremiumPassMode(" ALL ")).toBe("all");
  });

  it("defaults to the owner's two videos and reads a slug list", () => {
    expect(DEFAULT_PREMIUM_SLUGS).toEqual(["jj", "test-transkodowania"]);
    expect([...readPremiumPassConfig({ PREMIUM_PASS_EXPERIMENT: "all" })!.slugs]).toEqual(["jj", "test-transkodowania"]);
    expect([...readPremiumPassConfig({ PREMIUM_PASS_EXPERIMENT: "all", PREMIUM_PASS_VIDEO_SLUGS: " A , b,," })!.slugs]).toEqual(["a", "b"]);
    expect(readPremiumPassConfig({ PREMIUM_PASS_EXPERIMENT: "all", PREMIUM_PASS_VIDEO_SLUGS: "" })!.slugs.size).toBe(0);
  });

  it("all: everyone sees it, ADMIN included; system never", () => {
    const env = { PREMIUM_PASS_EXPERIMENT: "all" };
    expect(premiumPassFor({ type: "guest" }, env)).not.toBeNull();
    expect(premiumPassFor({ type: "user", userId: "u1" }, env)).not.toBeNull();
    expect(premiumPassFor({ type: "admin", userId: "a1" }, env)).not.toBeNull();
    expect(premiumPassFor({ type: "system", reason: "cron" }, env)).toBeNull();
  });

  it("testers: only the listed account ids (an admin too, if listed)", () => {
    const env = { PREMIUM_PASS_EXPERIMENT: "testers", PREMIUM_PASS_TESTER_IDS: "u1, a1" };
    expect(premiumPassFor({ type: "guest" }, env)).toBeNull();
    expect(premiumPassFor({ type: "user", userId: "u2" }, env)).toBeNull();
    expect(premiumPassFor({ type: "user", userId: "u1" }, env)).not.toBeNull();
    expect(premiumPassFor({ type: "admin", userId: "a1" }, env)).not.toBeNull();
    expect(premiumPassFor({ type: "admin", userId: "a2" }, env)).toBeNull();
  });
});

describe("which videos are behind the pass", () => {
  const config = readPremiumPassConfig({ PREMIUM_PASS_EXPERIMENT: "all", PREMIUM_PASS_VIDEO_SLUGS: "jj,hero,premiere,draft,link" })!;

  it("listed live videos only; never the hero, an upcoming premiere or a draft", () => {
    expect(isPremiumPassVideo(live, config, now)).toBe(true);
    expect(isPremiumPassVideo({ ...live, slug: "link", status: "UNLISTED" }, config, now)).toBe(true);
    expect(isPremiumPassVideo({ ...live, slug: "other" }, config, now)).toBe(false);
    expect(isPremiumPassVideo({ ...live, slug: "hero", isMainFeatured: true }, config, now)).toBe(false);
    expect(isPremiumPassVideo({ ...live, slug: "premiere", premiereAt: new Date(now.getTime() + 86_400_000) }, config, now)).toBe(false);
    expect(isPremiumPassVideo({ ...live, slug: "premiere", premiereAt: new Date(now.getTime() - 86_400_000) }, config, now)).toBe(true);
    expect(isPremiumPassVideo({ ...live, slug: "draft", status: "DRAFT" }, config, now)).toBe(false);
  });

  it("the public marker exists only in mode all", () => {
    expect(isPremiumPassVideoForEveryone(live, { PREMIUM_PASS_EXPERIMENT: "all" }, now)).toBe(true);
    expect(isPremiumPassVideoForEveryone(live, { PREMIUM_PASS_EXPERIMENT: "testers", PREMIUM_PASS_TESTER_IDS: "u1" }, now)).toBe(false);
    expect(isPremiumPassVideoForEveryone(live, {}, now)).toBe(false);
  });
});

describe("products, prices and the pass record", () => {
  it("two passes, owner prices, one honest price each", () => {
    expect(PASS_PRODUCTS).toEqual([
      { id: "PASS_7D", days: 7, priceMinor: 1499 },
      { id: "PASS_30D", days: 30, priceMinor: 2900, bestValue: true },
    ]);
    expect(formatPassPrice(1499, "pl-PL").replace(/\s/g, " ")).toBe("14,99 zł");
    expect(formatPassPrice(2900, "pl-PL").replace(/\s/g, " ")).toBe("29,00 zł");
  });

  it("offer: demo flag, VAT, both products; a malformed offer is dropped", () => {
    const offer = buildPremiumPassOffer({ signedIn: true, premiumCount: 2, expiredAt: "2026-11-20T10:00:00.000Z" });
    expect(offer).toMatchObject({ demo: true, currency: "PLN", vatRatePercent: 23, premiumCount: 2, signedIn: true, expiredAt: "2026-11-20T10:00:00.000Z" });
    expect(offer.products.map((p) => p.id)).toEqual(["PASS_7D", "PASS_30D"]);
    expect(readPremiumPassOffer(offer)).toEqual(offer);
    expect(readPremiumPassOffer({ demo: false, products: offer.products })).toBeNull();
    expect(readPremiumPassOffer({ demo: true, products: [] })).toBeNull();
    expect(readPremiumPassOffer("x")).toBeNull();
  });

  it("bad JSON is no pass, never an exception; expiry is computed on read", () => {
    expect(parseDemoPassRecord("{not json")).toBeNull();
    expect(parseDemoPassRecord(JSON.stringify({ v: 2 }))).toBeNull();
    const record = {
      v: 1, product: "PASS_7D", provider: "DEMO", ref: "DEMO-7Q4K-2M9X", priceMinor: 1499, currency: "PLN", method: "blik",
      requestId: "8b1f9f3e-1d2c-4a5b-9c7d-0e1f2a3b4c5d", grantedAt: now.toISOString(), expiresAt: "2026-10-28T10:00:00.000Z",
      consents: { termsVersion: "demo-2026-10", waiverAt: now.toISOString() },
    };
    const parsed = parseDemoPassRecord(JSON.stringify(record))!;
    expect(parsed).toEqual(record);
    expect(passStateOf(parsed, now).state).toBe("active");
    expect(passStateOf(parsed, new Date("2026-10-28T10:00:00.000Z")).state).toBe("expired");
    expect(passStateOf(null, now).state).toBe("none");
  });

  it("DEMO- reference and masked e-mail", () => {
    expect(newDemoRef()).toMatch(/^DEMO-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(maskEmail("pawel.perfect@gmail.com")).toBe("pa•••@gmail.com");
    expect(maskEmail(null)).toBeNull();
  });
});
