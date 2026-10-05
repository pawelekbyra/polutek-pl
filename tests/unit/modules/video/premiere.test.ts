import { describe, expect, it } from "vitest";
import {
  effectivePublishedAt,
  isAllowedPremiereChange,
  isUpcomingPremiere,
} from "@/lib/modules/video";
import { formatPremiereCountdown, formatPremiereDate } from "@/lib/premiere";
import { createTx } from "@/lib/i18n/ui";

const NOW = new Date("2026-10-01T12:00:00.000Z");
const FUTURE = new Date("2026-10-05T18:00:00.000Z");
const PAST = new Date("2026-09-20T18:00:00.000Z");

describe("isUpcomingPremiere", () => {
  it("is true only for a PUBLISHED video whose premiere is still ahead", () => {
    expect(isUpcomingPremiere({ status: "PUBLISHED", premiereAt: FUTURE }, NOW)).toBe(true);
    expect(isUpcomingPremiere({ status: "PUBLISHED", premiereAt: FUTURE.toISOString() }, NOW)).toBe(true);
  });

  it("is false once the premiere has passed, exactly at the premiere, or without one", () => {
    expect(isUpcomingPremiere({ status: "PUBLISHED", premiereAt: PAST }, NOW)).toBe(false);
    expect(isUpcomingPremiere({ status: "PUBLISHED", premiereAt: NOW }, NOW)).toBe(false);
    expect(isUpcomingPremiere({ status: "PUBLISHED", premiereAt: null }, NOW)).toBe(false);
    expect(isUpcomingPremiere(null, NOW)).toBe(false);
  });

  it("never treats drafts or archived videos as upcoming", () => {
    expect(isUpcomingPremiere({ status: "DRAFT", premiereAt: FUTURE }, NOW)).toBe(false);
    expect(isUpcomingPremiere({ status: "ARCHIVED", premiereAt: FUTURE }, NOW)).toBe(false);
  });

  it("accepts public DTOs without a status (they only ever contain published videos)", () => {
    expect(isUpcomingPremiere({ premiereAt: FUTURE.toISOString() }, NOW)).toBe(true);
  });

  it("ignores an unparseable date", () => {
    expect(isUpcomingPremiere({ status: "PUBLISHED", premiereAt: "not-a-date" }, NOW)).toBe(false);
  });
});

describe("effectivePublishedAt", () => {
  it("dates a video from its premiere when the premiere is later than the stored publish time", () => {
    expect(effectivePublishedAt({ publishedAt: PAST, premiereAt: FUTURE })).toEqual(FUTURE);
  });

  it("keeps the stored publish time when there is no premiere or it came first", () => {
    expect(effectivePublishedAt({ publishedAt: PAST, premiereAt: null })).toEqual(PAST);
    expect(effectivePublishedAt({ publishedAt: FUTURE, premiereAt: PAST })).toEqual(FUTURE);
    expect(effectivePublishedAt({ publishedAt: null, premiereAt: null })).toBeNull();
  });
});

describe("isAllowedPremiereChange", () => {
  it("allows publish-now (null) and untouched (undefined)", () => {
    expect(isAllowedPremiereChange(null, FUTURE, NOW)).toBe(true);
    expect(isAllowedPremiereChange(undefined, PAST, NOW)).toBe(true);
  });

  it("requires a newly set or moved premiere to be in the future", () => {
    expect(isAllowedPremiereChange(FUTURE, null, NOW)).toBe(true);
    expect(isAllowedPremiereChange(PAST, null, NOW)).toBe(false);
    expect(isAllowedPremiereChange(PAST, FUTURE, NOW)).toBe(false);
  });

  it("accepts resubmitting the stored premiere unchanged, even after it passed", () => {
    expect(isAllowedPremiereChange(new Date(PAST), PAST.toISOString(), NOW)).toBe(true);
  });

  it("rejects an invalid date", () => {
    expect(isAllowedPremiereChange(new Date("nope"), null, NOW)).toBe(false);
  });
});

describe("premiere formatting", () => {
  it("formats the date in Europe/Warsaw", () => {
    // 23:00 UTC on 31 Dec is already 1 Jan in Warsaw (CET, UTC+1).
    expect(formatPremiereDate(new Date("2026-12-31T23:00:00.000Z"))).toBe("1.01.2027");
  });

  it("counts down to the given premiere and clamps at zero", () => {
    const target = new Date(NOW.getTime() + (2 * 86_400 + 3 * 3_600 + 4 * 60 + 5) * 1_000);
    expect(formatPremiereCountdown(createTx("pl"), target, NOW)).toBe("PREMIERA ZA 2D 3H 4M 5S");
    expect(formatPremiereCountdown(createTx("en"), target, NOW)).toBe("PREMIERES IN 2D 3H 4M 5S");
    expect(formatPremiereCountdown(createTx("pl"), PAST, NOW)).toBe("PREMIERA ZA 0D 0H 0M 0S");
  });
});
