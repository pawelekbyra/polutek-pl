import { describe, expect, it } from "vitest";
import { constantTimeEqual, isHealthTokenAuthorized, isHealthTokenValue } from "@/lib/api/health-token";

const ENV = { HEALTHCHECK_TOKEN: "s3cret-token-value" };

describe("constantTimeEqual", () => {
  it("compares equal and different strings, including different lengths", () => {
    expect(constantTimeEqual("abc", "abc")).toBe(true);
    expect(constantTimeEqual("abc", "abd")).toBe(false);
    expect(constantTimeEqual("abc", "abcd")).toBe(false);
    expect(constantTimeEqual("", "a")).toBe(false);
    expect(constantTimeEqual("ż", "ż")).toBe(true);
  });
});

describe("isHealthTokenAuthorized", () => {
  it("accepts the x-health-token header", () => {
    expect(isHealthTokenAuthorized({ headers: new Headers({ "x-health-token": ENV.HEALTHCHECK_TOKEN }) }, ENV)).toBe(true);
  });

  it("rejects wrong, shorter and longer tokens without throwing", () => {
    for (const bad of ["nope", "s3cret-token-valu", "s3cret-token-value-extra", ""]) {
      expect(isHealthTokenAuthorized({ headers: new Headers({ "x-health-token": bad }) }, ENV)).toBe(false);
    }
  });

  it("is false when the env var is unset or empty, even if the header is empty", () => {
    const headers = new Headers({ "x-health-token": "" });
    expect(isHealthTokenAuthorized({ headers }, {})).toBe(false);
    expect(isHealthTokenAuthorized({ headers }, { HEALTHCHECK_TOKEN: "" })).toBe(false);
    expect(isHealthTokenValue("x", {})).toBe(false);
  });

  it("ignores the legacy header names (only x-health-token is accepted)", () => {
    const headers = new Headers({ "x-healthcheck-token": ENV.HEALTHCHECK_TOKEN, "x-diagnostics-token": ENV.HEALTHCHECK_TOKEN });
    expect(isHealthTokenAuthorized({ headers }, ENV)).toBe(false);
  });

  it("does not look at a query-string token", () => {
    // The helper only receives headers; a ?token= value can never authorize.
    expect(isHealthTokenAuthorized({ headers: new Headers() }, ENV)).toBe(false);
  });
});
