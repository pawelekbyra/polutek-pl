// patron zone (docs/architecture/patron-zone.md)
import { describe, expect, it } from "vitest";
import {
  DEFAULT_PREMIUM_SLUGS,
  isPremiumPassVideo,
  isPremiumPassVideoForEveryone,
  PATRON_DEFAULT_PRODUCT_ID,
  PATRON_MAX_AHEAD_DAYS,
  PATRON_CURRENCIES,
  PATRON_PRICES,
  PATRON_PRODUCTS,
  PLAN_DURATIONS,
  isPatronCurrency,
  patronCurrencyForLanguage,
  patronPrice,
  patronProduct,
  parsePremiumPassMode,
  premiumPassFor,
  readPremiumPassConfig,
} from "@/lib/modules/patron-zone";
import { cheapestProduct, defaultProduct, formatPassPrice, readPremiumPassOffer, buildPremiumPassOffer } from "@/lib/modules/patron-zone/domain/offer";
import { addMonths, addPlanDuration, applyProduct, extendedExpiry, maskEmail, newDemoRef, parsePassRecord, passStateOf, purchaseBlock, subtractPlanDuration, toPassStatusDto } from "@/lib/modules/patron-zone/domain/pass-state";

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

  it("two fixed, time-limited options with the owner's prices (30 days, 3 months); the 3-month one is the default and the best value; no other product exists", () => {
    expect(PATRON_PRODUCTS).toEqual([
      { id: "ACCESS_30D", duration: { days: 30 } },
      { id: "ACCESS_LIFETIME", duration: { months: 3 }, bestValue: true },
    ]);
    expect(PLAN_DURATIONS).toEqual({ ACCESS_30D: { days: 30 }, ACCESS_LIFETIME: { months: 3 } }); // the one place that configures lengths
    expect([patronPrice("ACCESS_30D", "PLN"), patronPrice("ACCESS_LIFETIME", "PLN")]).toEqual([1499, 2999]);
    expect(PATRON_DEFAULT_PRODUCT_ID).toBe("ACCESS_LIFETIME");
    for (const unknown of ["ACCESS_7D", "", null, undefined, 1, "access_30d", { id: "ACCESS_30D" }]) expect(patronProduct(unknown)).toBeNull();
    expect(formatPassPrice(1499, "pl-PL").replace(/\s/g, " ")).toBe("14,99 zł");
    expect(formatPassPrice(2999, "pl-PL").replace(/\s/g, " ")).toBe("29,99 zł");
  });

  it("the price table covers every product in every currency of the tip gateway; unknown input is never priced", () => {
    expect([...PATRON_CURRENCIES]).toEqual(["PLN", "EUR", "USD", "CHF", "GBP"]);
    for (const product of PATRON_PRODUCTS) {
      for (const currency of PATRON_CURRENCIES) {
        const amount = patronPrice(product.id, currency)!;
        expect(Number.isInteger(amount) && amount >= 200).toBe(true); // above Stripe's minimum charge
        expect(amount).toBe(PATRON_PRICES[product.id][currency]);
      }
      expect(PATRON_PRICES[product.id].PLN).toBe(product.id === "ACCESS_30D" ? 1499 : 2999);
    }
    for (const currency of PATRON_CURRENCIES) expect(PATRON_PRICES.ACCESS_LIFETIME[currency]).toBeGreaterThan(PATRON_PRICES.ACCESS_30D[currency]);
    expect(patronPrice("ACCESS_30D", "eur")).toBe(399); // case-insensitive like Stripe's lower-case codes
    for (const [id, cur] of [["ACCESS_FREE", "PLN"], ["ACCESS_30D", "SEK"], ["ACCESS_30D", ""], [null, "PLN"], ["ACCESS_30D", null], ["__proto__", "PLN"], ["ACCESS_30D", "__proto__"]] as const) expect(patronPrice(id, cur)).toBeNull();
    expect(isPatronCurrency("EUR")).toBe(true);
    expect(isPatronCurrency("eur")).toBe(false);
    expect(isPatronCurrency("SEK")).toBe(false);
    expect([patronCurrencyForLanguage("pl"), patronCurrencyForLanguage("de"), patronCurrencyForLanguage("en"), patronCurrencyForLanguage("zh")]).toEqual(["PLN", "EUR", "USD", "USD"]);
  });

  it("offer: PLN, VAT, both products, default, payments info; a malformed offer is dropped", () => {
    const offer = buildPremiumPassOffer({ signedIn: true, premiumCount: 2, expiredAt: "2026-11-20T10:00:00.000Z", payments: { mode: "stripe", available: true, stripeMode: "test" } });
    expect(offer).toMatchObject({ currencies: ["PLN", "EUR", "USD", "CHF", "GBP"], vatRatePercent: 0, defaultProductId: "ACCESS_LIFETIME", premiumCount: 2, signedIn: true, expiredAt: "2026-11-20T10:00:00.000Z", payments: { mode: "stripe", available: true, stripeMode: "test" } });
    expect(offer.products.map((p) => [p.id, p.prices.PLN, p.days])).toEqual([["ACCESS_30D", 1499, 30], ["ACCESS_LIFETIME", 2999, null]]);
    expect(offer.products.map((p) => p.months)).toEqual([null, 3]); // days null no longer means unlimited: the plan is counted in months
    expect(offer.products[0]!.prices).toEqual({ PLN: 1499, EUR: 399, USD: 449, CHF: 399, GBP: 349 });
    expect(cheapestProduct(offer).id).toBe("ACCESS_30D");
    expect(cheapestProduct(offer, "EUR").prices.EUR).toBe(399);
    expect(defaultProduct(offer).id).toBe("ACCESS_LIFETIME");
    expect(Object.keys(offer)).not.toEqual(expect.arrayContaining(["minMinor", "maxMinor", "suggestedMinor", "defaultMinor"]));
    expect(buildPremiumPassOffer({ signedIn: false, premiumCount: 0 }).payments).toEqual({ mode: "demo" });
    expect(readPremiumPassOffer(offer)).toEqual(offer);
    expect(readPremiumPassOffer({ ...offer, payments: undefined })).toBeNull();
    expect(readPremiumPassOffer({ ...offer, products: [] })).toBeNull();
    expect(readPremiumPassOffer({ ...offer, products: [{ id: "ACCESS_FREE", days: 1, months: null, prices: offer.products[0]!.prices }] })).toBeNull();
    expect(readPremiumPassOffer({ ...offer, products: [{ id: "ACCESS_30D", days: 30, months: null, prices: { PLN: 1499 } }] })).toBeNull();
    expect(readPremiumPassOffer("x")).toBeNull();
    expect(readPremiumPassOffer({ ...offer, payments: { mode: "live" } })!.payments).toEqual({ mode: "stripe", available: false });
  });

  it("bad JSON is no access, never an exception; a record needs an end date; expiry is computed on read", () => {
    expect(parsePassRecord("{not json")).toBeNull();
    expect(parsePassRecord(JSON.stringify({ v: 4 }))).toBeNull();
    expect(parsePassRecord(JSON.stringify({ ...base, provider: "PAYPAL" }))).toBeNull();
    expect(parsePassRecord(JSON.stringify({ ...base, currency: "SEK" }))).toBeNull();
    expect(parsePassRecord(JSON.stringify({ ...base, productId: "ACCESS_7D" }))).toBeNull();
    expect(parsePassRecord(JSON.stringify({ ...base, expiresAt: null }))).toBeNull();
    const parsed = parsePassRecord(JSON.stringify(base))!;
    expect(parsed).toEqual(base);
    expect(passStateOf(parsed, now).state).toBe("active");
    expect(passStateOf(parsed, new Date("2026-11-20T10:00:00.000Z")).state).toBe("expired");
    expect(passStateOf(null, now).state).toBe("none");
  });

  it("a legacy unlimited record (lifetime: true) is read as the 3-month plan from its grant date, never as unlimited; the stored row is not rewritten", () => {
    const raw = JSON.stringify({ ...base, productId: "ACCESS_LIFETIME", lifetime: true, lifetimePaymentId: "pay_1", expiresAt: null, grantedAt: "2026-10-26T20:02:17.960Z" });
    const record = parsePassRecord(raw)!;
    expect(record).toMatchObject({ lifetime: false, lifetimePaymentId: null, expiresAt: "2027-01-26T20:02:17.960Z" }); // 26.10 21:02 CET + 3 months = 26.01 21:02 CET
    expect(passStateOf(record, now).state).toBe("active");
    expect(passStateOf(record, new Date("2126-01-01T00:00:00.000Z")).state).toBe("expired");
    expect(toPassStatusDto(passStateOf(record, now))).toMatchObject({ state: "active", lifetime: false, expiresAt: "2027-01-26T20:02:17.960Z", productId: "ACCESS_LIFETIME" });
    // a 30-day access that was converted and still runs longer than 3 months from the grant keeps its longer end
    const longer = parsePassRecord(JSON.stringify({ ...base, productId: "ACCESS_LIFETIME", lifetime: true, expiresAt: "2027-03-01T10:00:00.000Z" }))!;
    expect(longer.expiresAt).toBe("2027-03-01T10:00:00.000Z");
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

  it("calendar months in Europe/Warsaw: same day and time of day, a missing day clamps to the month end, DST does not move the wall clock", () => {
    const at = (iso: string, months: number) => addMonths(new Date(iso), months).toISOString();
    expect(at("2026-10-12T10:00:00.000Z", 3)).toBe("2027-01-12T11:00:00.000Z"); // 12:00 CEST -> 12:00 CET
    expect(at("2026-10-31T10:00:00.000Z", 3)).toBe("2027-01-31T10:00:00.000Z");
    expect(at("2026-11-30T10:00:00.000Z", 3)).toBe("2027-02-28T10:00:00.000Z"); // 30.11 -> clamp to 28.02
    expect(at("2027-11-30T10:00:00.000Z", 3)).toBe("2028-02-29T10:00:00.000Z"); // leap year
    expect(at("2026-10-31T10:00:00.000Z", 3)).not.toBe(new Date(new Date("2026-10-31T10:00:00.000Z").getTime() + 90 * DAY).toISOString()); // not the same as 90 days (29.01)
    expect(at("2026-12-15T10:00:00.000Z", 3)).toBe("2027-03-15T10:00:00.000Z"); // CET both sides
    expect(at("2027-01-15T10:00:00.000Z", 3)).toBe("2027-04-15T09:00:00.000Z"); // CET -> CEST: 11:00 stays 11:00 local
    expect(at("2026-11-12T23:30:00.000Z", 3)).toBe("2027-02-12T23:30:00.000Z"); // 00:30 next day local, still the 13th -> 13.02
    expect(at("2026-12-31T23:59:59.999Z", 2)).toBe("2027-02-28T23:59:59.999Z"); // 01.01 00:59:59.999 local -> 01.03 00:59:59.999 local (milliseconds kept)
  });

  it("plan lengths come from PLAN_DURATIONS: +30 days or +3 calendar months, and back out again on a refund", () => {
    const from = new Date("2026-10-31T10:00:00.000Z");
    expect(addPlanDuration(from, PLAN_DURATIONS.ACCESS_30D).toISOString()).toBe("2026-11-30T10:00:00.000Z");
    expect(addPlanDuration(from, PLAN_DURATIONS.ACCESS_LIFETIME).toISOString()).toBe("2027-01-31T10:00:00.000Z");
    expect(subtractPlanDuration(addPlanDuration(from, PLAN_DURATIONS.ACCESS_30D), PLAN_DURATIONS.ACCESS_30D).toISOString()).toBe(from.toISOString());
    expect(subtractPlanDuration(new Date("2027-01-31T10:00:00.000Z"), PLAN_DURATIONS.ACCESS_LIFETIME).toISOString()).toBe("2026-10-31T10:00:00.000Z");
  });

  it("an access extends from its end when active, from now otherwise (30 days and 3 months alike)", () => {
    const active = parsePassRecord(JSON.stringify(base))!;
    expect(extendedExpiry(active, thirty.duration, now).toISOString()).toBe("2026-12-20T10:00:00.000Z");
    expect(extendedExpiry(null, thirty.duration, now).toISOString()).toBe("2026-11-20T10:00:00.000Z");
    expect(extendedExpiry({ ...active, expiresAt: "2026-01-01T00:00:00.000Z" }, thirty.duration, now).toISOString()).toBe("2026-11-20T10:00:00.000Z");
    expect(applyProduct(null, thirty, now)).toEqual({ lifetime: false, expiresAt: "2026-11-20T10:00:00.000Z", grantedAt: now.toISOString() });
    // 3 months: new access = now + 3 months (21.10 12:00 CEST -> 21.01 12:00 CET); running access = its end + 3 months, grant date kept
    expect(applyProduct(null, life, now)).toEqual({ lifetime: false, expiresAt: "2027-01-21T11:00:00.000Z", grantedAt: now.toISOString() });
    expect(applyProduct(active, life, now)).toEqual({ lifetime: false, expiresAt: "2027-02-20T10:00:00.000Z", grantedAt: base.grantedAt });
    const expired = { ...active, expiresAt: "2026-10-01T10:00:00.000Z" };
    expect(applyProduct(expired, life, now)).toEqual({ lifetime: false, expiresAt: "2027-01-21T11:00:00.000Z", grantedAt: now.toISOString() });
    // never unlimited, whatever the plan
    for (const p of PATRON_PRODUCTS) expect(applyProduct(active, p, now).expiresAt).toMatch(/^\d{4}-/);
  });

  it("purchase rules: every plan extends a running access; nothing is bought past 365 days ahead; the 3-month plan is capped like the 30-day one", () => {
    const active = parsePassRecord(JSON.stringify(base))!;
    expect(purchaseBlock(null, thirty, now)).toBeNull();
    expect(purchaseBlock(null, life, now)).toBeNull();
    expect(purchaseBlock(active, thirty, now)).toBeNull();
    expect(purchaseBlock(active, life, now)).toBeNull();
    const far = { ...active, expiresAt: new Date(now.getTime() + (PATRON_MAX_AHEAD_DAYS - 29) * DAY).toISOString() };
    expect(purchaseBlock(far, thirty, now)).toBe("MAX_AHEAD");
    expect(purchaseBlock(far, life, now)).toBe("MAX_AHEAD");
    const inside = { ...active, expiresAt: new Date(now.getTime() + (PATRON_MAX_AHEAD_DAYS - 30) * DAY).toISOString() };
    expect(purchaseBlock(inside, thirty, now)).toBeNull();
    const nearLife = { ...active, expiresAt: new Date(now.getTime() + 270 * DAY).toISOString() }; // + 3 months ~ 360 days ahead
    expect(purchaseBlock(nearLife, life, now)).toBeNull();
    expect(purchaseBlock({ ...nearLife, expiresAt: new Date(now.getTime() + 280 * DAY).toISOString() }, life, now)).toBe("MAX_AHEAD");
  });

  it("DEMO- reference and masked e-mail", () => {
    expect(newDemoRef()).toMatch(/^DEMO-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(maskEmail("pawel.perfect@gmail.com")).toBe("pa•••@gmail.com");
    expect(maskEmail(null)).toBeNull();
  });
});
