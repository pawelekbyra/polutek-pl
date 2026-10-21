// experiment: premium-pass (docs/experiments/premium-pass.md)
import { describe, expect, it } from "vitest";
import {
  DEFAULT_PREMIUM_SLUGS,
  isPremiumPassVideo,
  isPremiumPassVideoForEveryone,
  PATRON_DEFAULT_PRODUCT_ID,
  PATRON_MAX_AHEAD_DAYS,
  PATRON_PRODUCTS,
  patronProduct,
  parsePremiumPassMode,
  premiumPassFor,
  readPremiumPassConfig,
} from "@/lib/modules/experiment-premium-pass";
import { cheapestProduct, defaultProduct, formatPassPrice, readPremiumPassOffer, buildPremiumPassOffer } from "@/lib/modules/experiment-premium-pass/domain/offer";
import { applyProduct, extendedExpiry, maskEmail, newDemoRef, parsePassRecord, passStateOf, purchaseBlock, toPassStatusDto } from "@/lib/modules/experiment-premium-pass/domain/pass-state";

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

describe("the two options, the offer and the access record", () => {
  const DAY = 86_400_000;
  const thirty = patronProduct("ACCESS_30D")!;
  const life = patronProduct("ACCESS_LIFETIME")!;
  const base = {
    v: 3, provider: "STRIPE", ref: "pay_1", productId: "ACCESS_30D", priceMinor: 1499, totalMinor: 1499, currency: "PLN", method: "blik", paymentIds: ["pay_1"],
    lifetime: false, lifetimePaymentId: null, grantedAt: now.toISOString(), expiresAt: "2026-11-20T10:00:00.000Z", consents: { termsVersion: "patron-2026-10-draft", waiverAt: now.toISOString() },
  };

  it("two fixed options with the owner's prices; the unlimited one is the default and the best value; no other product exists", () => {
    expect(PATRON_PRODUCTS).toEqual([
      { id: "ACCESS_30D", days: 30, priceMinor: 1499 },
      { id: "ACCESS_LIFETIME", days: null, priceMinor: 2999, bestValue: true },
    ]);
    expect(PATRON_DEFAULT_PRODUCT_ID).toBe("ACCESS_LIFETIME");
    for (const unknown of ["ACCESS_7D", "", null, undefined, 1, "access_30d", { id: "ACCESS_30D" }]) expect(patronProduct(unknown)).toBeNull();
    expect(formatPassPrice(1499, "pl-PL").replace(/\s/g, " ")).toBe("14,99 zł");
    expect(formatPassPrice(2999, "pl-PL").replace(/\s/g, " ")).toBe("29,99 zł");
  });

  it("offer: PLN, VAT, both products, default, payments info; a malformed offer is dropped", () => {
    const offer = buildPremiumPassOffer({ signedIn: true, premiumCount: 2, expiredAt: "2026-11-20T10:00:00.000Z", payments: { mode: "stripe", available: true, stripeMode: "test" } });
    expect(offer).toMatchObject({ currency: "PLN", vatRatePercent: 23, defaultProductId: "ACCESS_LIFETIME", premiumCount: 2, signedIn: true, expiredAt: "2026-11-20T10:00:00.000Z", payments: { mode: "stripe", available: true, stripeMode: "test" } });
    expect(offer.products.map((p) => [p.id, p.priceMinor, p.days])).toEqual([["ACCESS_30D", 1499, 30], ["ACCESS_LIFETIME", 2999, null]]);
    expect(cheapestProduct(offer).id).toBe("ACCESS_30D");
    expect(defaultProduct(offer).id).toBe("ACCESS_LIFETIME");
    expect(Object.keys(offer)).not.toEqual(expect.arrayContaining(["minMinor", "maxMinor", "suggestedMinor", "defaultMinor"]));
    expect(buildPremiumPassOffer({ signedIn: false, premiumCount: 0 }).payments).toEqual({ mode: "demo" });
    expect(readPremiumPassOffer(offer)).toEqual(offer);
    expect(readPremiumPassOffer({ ...offer, payments: undefined })).toBeNull();
    expect(readPremiumPassOffer({ ...offer, products: [] })).toBeNull();
    expect(readPremiumPassOffer({ ...offer, products: [{ id: "ACCESS_FREE", days: 1, priceMinor: 0 }] })).toBeNull();
    expect(readPremiumPassOffer("x")).toBeNull();
    expect(readPremiumPassOffer({ ...offer, payments: { mode: "live" } })!.payments).toEqual({ mode: "stripe", available: false });
  });

  it("bad JSON is no access, never an exception; a non-lifetime record needs an end date; expiry is computed on read", () => {
    expect(parsePassRecord("{not json")).toBeNull();
    expect(parsePassRecord(JSON.stringify({ v: 4 }))).toBeNull();
    expect(parsePassRecord(JSON.stringify({ ...base, provider: "PAYPAL" }))).toBeNull();
    expect(parsePassRecord(JSON.stringify({ ...base, currency: "EUR" }))).toBeNull();
    expect(parsePassRecord(JSON.stringify({ ...base, productId: "ACCESS_7D" }))).toBeNull();
    expect(parsePassRecord(JSON.stringify({ ...base, expiresAt: null }))).toBeNull();
    const parsed = parsePassRecord(JSON.stringify(base))!;
    expect(parsed).toEqual(base);
    expect(passStateOf(parsed, now).state).toBe("active");
    expect(passStateOf(parsed, new Date("2026-11-20T10:00:00.000Z")).state).toBe("expired");
    expect(passStateOf(null, now).state).toBe("none");
  });

  it("a lifetime record has an explicit marker, no date, and is active whatever the date", () => {
    const record = parsePassRecord(JSON.stringify({ ...base, productId: "ACCESS_LIFETIME", lifetime: true, lifetimePaymentId: "pay_1", expiresAt: null }))!;
    expect(record.lifetime).toBe(true);
    expect(passStateOf(record, new Date("2126-01-01T00:00:00.000Z")).state).toBe("active");
    expect(toPassStatusDto(passStateOf(record, now))).toMatchObject({ state: "active", lifetime: true, expiresAt: null, productId: "ACCESS_LIFETIME" });
    expect(toPassStatusDto(passStateOf(parsePassRecord(JSON.stringify(base)), now))).toMatchObject({ lifetime: false, expiresAt: "2026-11-20T10:00:00.000Z" });
  });

  it("still reads earlier versions (fixed passes, pay-what-you-want) as 30-day grants", () => {
    const v1 = {
      v: 1, product: "PASS_7D", provider: "DEMO", ref: "DEMO-7Q4K-2M9X", priceMinor: 1499, currency: "PLN", method: "blik",
      requestId: "8b1f9f3e-1d2c-4a5b-9c7d-0e1f2a3b4c5d", grantedAt: now.toISOString(), expiresAt: "2026-10-28T10:00:00.000Z",
      consents: { termsVersion: "demo-2026-10", waiverAt: now.toISOString() },
    };
    expect(parsePassRecord(JSON.stringify(v1))).toMatchObject({ v: 3, provider: "DEMO", productId: "ACCESS_30D", totalMinor: 1499, paymentIds: [], lifetime: false, lifetimePaymentId: null });
    const { v: _v, productId: _p, lifetime: _l, lifetimePaymentId: _lp, ...rest } = base;
    const v2 = parsePassRecord(JSON.stringify({ ...rest, v: 2, priceMinor: 2000, totalMinor: 2000 }))!;
    expect(v2).toMatchObject({ v: 3, provider: "STRIPE", productId: "ACCESS_30D", priceMinor: 2000, lifetime: false, expiresAt: base.expiresAt, paymentIds: ["pay_1"] });
  });

  it("30 days extends from the end when active, from now otherwise", () => {
    const active = parsePassRecord(JSON.stringify(base))!;
    expect(extendedExpiry(active, 30, now).toISOString()).toBe("2026-12-20T10:00:00.000Z");
    expect(extendedExpiry(null, 30, now).toISOString()).toBe("2026-11-20T10:00:00.000Z");
    expect(extendedExpiry({ ...active, expiresAt: "2026-01-01T00:00:00.000Z" }, 30, now).toISOString()).toBe("2026-11-20T10:00:00.000Z");
    expect(applyProduct(null, thirty, now)).toEqual({ lifetime: false, expiresAt: "2026-11-20T10:00:00.000Z", grantedAt: now.toISOString() });
  });

  it("unlimited sets the lifetime marker (keeping a running end date only as history); 30 days on top of lifetime changes nothing", () => {
    const active = parsePassRecord(JSON.stringify(base))!;
    expect(applyProduct(null, life, now)).toEqual({ lifetime: true, expiresAt: null, grantedAt: now.toISOString() });
    expect(applyProduct(active, life, now)).toEqual({ lifetime: true, expiresAt: base.expiresAt, grantedAt: base.grantedAt });
    const lifetime = { ...active, lifetime: true, expiresAt: null };
    expect(applyProduct(lifetime, thirty, now)).toMatchObject({ lifetime: true, expiresAt: null });
  });

  it("purchase rules: lifetime blocks everything; 30 days is capped 365 days ahead; unlimited is never capped", () => {
    const active = parsePassRecord(JSON.stringify(base))!;
    expect(purchaseBlock(null, thirty, now)).toBeNull();
    expect(purchaseBlock(null, life, now)).toBeNull();
    expect(purchaseBlock(active, thirty, now)).toBeNull();
    expect(purchaseBlock(active, life, now)).toBeNull();
    const lifetime = { ...active, lifetime: true };
    expect(purchaseBlock(lifetime, thirty, now)).toBe("ALREADY_LIFETIME");
    expect(purchaseBlock(lifetime, life, now)).toBe("ALREADY_LIFETIME");
    const far = { ...active, expiresAt: new Date(now.getTime() + (PATRON_MAX_AHEAD_DAYS - 29) * DAY).toISOString() };
    expect(purchaseBlock(far, thirty, now)).toBe("MAX_AHEAD");
    expect(purchaseBlock(far, life, now)).toBeNull();
    const inside = { ...active, expiresAt: new Date(now.getTime() + (PATRON_MAX_AHEAD_DAYS - 30) * DAY).toISOString() };
    expect(purchaseBlock(inside, thirty, now)).toBeNull();
  });

  it("DEMO- reference and masked e-mail", () => {
    expect(newDemoRef()).toMatch(/^DEMO-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(maskEmail("pawel.perfect@gmail.com")).toBe("pa•••@gmail.com");
    expect(maskEmail(null)).toBeNull();
  });
});
