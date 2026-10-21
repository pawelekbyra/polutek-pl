// experiment: premium-pass (docs/experiments/premium-pass.md)
import { describe, expect, it } from "vitest";
import {
  DEFAULT_PREMIUM_SLUGS,
  isPremiumPassVideo,
  isPremiumPassVideoForEveryone,
  PATRON_ACCESS_DAYS,
  PATRON_DEFAULT_MINOR,
  PATRON_MAX_AHEAD_DAYS,
  PATRON_MAX_MINOR,
  PATRON_MIN_MINOR,
  PATRON_SUGGESTED_MINOR,
  parsePremiumPassMode,
  premiumPassFor,
  readPremiumPassConfig,
  validatePatronAmount,
} from "@/lib/modules/experiment-premium-pass";
import { formatPassPrice, readPremiumPassOffer, buildPremiumPassOffer } from "@/lib/modules/experiment-premium-pass/domain/offer";
import { extendedExpiry, maskEmail, newDemoRef, parsePassRecord, passStateOf, wouldExceedMaxAhead } from "@/lib/modules/experiment-premium-pass/domain/pass-state";

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

describe("amounts, access length and the access record", () => {
  it("pay what you want: owner-agreed limits, suggested amounts inside them, one access length", () => {
    expect([PATRON_MIN_MINOR, PATRON_MAX_MINOR, PATRON_DEFAULT_MINOR]).toEqual([500, 100_000, 2500]);
    expect(PATRON_SUGGESTED_MINOR).toEqual([1000, 2500, 5000, 10_000]);
    expect(PATRON_SUGGESTED_MINOR.every((v) => validatePatronAmount(v) === null)).toBe(true);
    expect(PATRON_SUGGESTED_MINOR).toContain(PATRON_DEFAULT_MINOR);
    expect(PATRON_ACCESS_DAYS).toBe(30);
    expect(formatPassPrice(1000, "pl-PL").replace(/\s/g, " ")).toBe("10 zł");
    expect(formatPassPrice(1550, "pl-PL").replace(/\s/g, " ")).toBe("15,50 zł");
  });

  it("validates amounts on the server: integers (grosze) within [min, max] only", () => {
    expect(validatePatronAmount(500)).toBeNull();
    expect(validatePatronAmount(100_000)).toBeNull();
    expect(validatePatronAmount(499)).toBe("TOO_LOW");
    expect(validatePatronAmount(100_001)).toBe("TOO_HIGH");
    expect(validatePatronAmount(0)).toBe("TOO_LOW");
    expect(validatePatronAmount(-500)).toBe("TOO_LOW");
    for (const bad of [12.5, Number.NaN, Infinity, "2500", null, undefined]) expect(validatePatronAmount(bad)).toBe("INTEGER");
  });

  it("offer: PLN, VAT, amounts, access days, payments info; a malformed offer is dropped", () => {
    const offer = buildPremiumPassOffer({ signedIn: true, premiumCount: 2, expiredAt: "2026-11-20T10:00:00.000Z", payments: { mode: "stripe", available: true, stripeMode: "test" } });
    expect(offer).toMatchObject({
      currency: "PLN", vatRatePercent: 23, accessDays: 30, minMinor: 500, maxMinor: 100_000, defaultMinor: 2500,
      suggestedMinor: [1000, 2500, 5000, 10_000], premiumCount: 2, signedIn: true, expiredAt: "2026-11-20T10:00:00.000Z",
      payments: { mode: "stripe", available: true, stripeMode: "test" },
    });
    expect(buildPremiumPassOffer({ signedIn: false, premiumCount: 0 }).payments).toEqual({ mode: "demo" });
    expect(readPremiumPassOffer(offer)).toEqual(offer);
    expect(readPremiumPassOffer({ ...offer, payments: undefined })).toBeNull();
    expect(readPremiumPassOffer({ ...offer, minMinor: "5" })).toBeNull();
    expect(readPremiumPassOffer("x")).toBeNull();
    // unknown payment info is read as "no payment possible", never as demo
    expect(readPremiumPassOffer({ ...offer, payments: { mode: "live" } })!.payments).toEqual({ mode: "stripe", available: false });
  });

  const base = {
    v: 2, provider: "STRIPE", ref: "pay_1", priceMinor: 2500, totalMinor: 2500, currency: "PLN", method: "blik", paymentIds: ["pay_1"],
    grantedAt: now.toISOString(), expiresAt: "2026-11-20T10:00:00.000Z", consents: { termsVersion: "patron-2026-10-draft", waiverAt: now.toISOString() },
  };

  it("bad JSON is no access, never an exception; expiry is computed on read", () => {
    expect(parsePassRecord("{not json")).toBeNull();
    expect(parsePassRecord(JSON.stringify({ v: 3 }))).toBeNull();
    expect(parsePassRecord(JSON.stringify({ ...base, provider: "PAYPAL" }))).toBeNull();
    expect(parsePassRecord(JSON.stringify({ ...base, currency: "EUR" }))).toBeNull();
    const parsed = parsePassRecord(JSON.stringify(base))!;
    expect(parsed).toEqual(base);
    expect(passStateOf(parsed, now).state).toBe("active");
    expect(passStateOf(parsed, new Date("2026-11-20T10:00:00.000Z")).state).toBe("expired");
    expect(passStateOf(null, now).state).toBe("none");
  });

  it("still reads the first version of the experiment (two fixed passes) as a demo grant", () => {
    const legacy = {
      v: 1, product: "PASS_7D", provider: "DEMO", ref: "DEMO-7Q4K-2M9X", priceMinor: 1499, currency: "PLN", method: "blik",
      requestId: "8b1f9f3e-1d2c-4a5b-9c7d-0e1f2a3b4c5d", grantedAt: now.toISOString(), expiresAt: "2026-10-28T10:00:00.000Z",
      consents: { termsVersion: "demo-2026-10", waiverAt: now.toISOString() },
    };
    const parsed = parsePassRecord(JSON.stringify(legacy))!;
    expect(parsed).toMatchObject({ v: 2, provider: "DEMO", ref: "DEMO-7Q4K-2M9X", priceMinor: 1499, totalMinor: 1499, paymentIds: [] });
    expect(passStateOf(parsed, now).state).toBe("active");
  });

  it("a payment extends access from its end when active, from now otherwise; the horizon is capped", () => {
    const active = parsePassRecord(JSON.stringify(base))!;
    expect(extendedExpiry(active, now).toISOString()).toBe("2026-12-20T10:00:00.000Z");
    expect(extendedExpiry(null, now).toISOString()).toBe("2026-11-20T10:00:00.000Z");
    expect(extendedExpiry({ ...active, expiresAt: "2026-01-01T00:00:00.000Z" }, now).toISOString()).toBe("2026-11-20T10:00:00.000Z");
    expect(wouldExceedMaxAhead(null, now)).toBe(false);
    expect(wouldExceedMaxAhead(active, now)).toBe(false);
    const farAhead = { ...active, expiresAt: new Date(now.getTime() + (PATRON_MAX_AHEAD_DAYS - 29) * 86_400_000).toISOString() };
    expect(wouldExceedMaxAhead(farAhead, now)).toBe(true);
    const justInside = { ...active, expiresAt: new Date(now.getTime() + (PATRON_MAX_AHEAD_DAYS - 30) * 86_400_000).toISOString() };
    expect(wouldExceedMaxAhead(justInside, now)).toBe(false);
  });

  it("DEMO- reference and masked e-mail", () => {
    expect(newDemoRef()).toMatch(/^DEMO-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(maskEmail("pawel.perfect@gmail.com")).toBe("pa•••@gmail.com");
    expect(maskEmail(null)).toBeNull();
  });
});
