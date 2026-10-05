import { describe, expect, it } from "vitest";
import { buildIntegrationChecks, stripeKeyFacts } from "@/lib/modules/admin-overview";

const last = { stripeEventAt: null, emailEventAt: null, paymentAt: null, broadcastAt: null };
const byId = (checks: ReturnType<typeof buildIntegrationChecks>, id: string) => checks.find((c) => c.id === id)!;

describe("integration status never leaks a secret", () => {
  it("reads only the public prefix of the Stripe key and never echoes any value", () => {
    const env = { STRIPE_SECRET_KEY: "sk_live_SECRETSECRETSECRET", RESEND_API_KEY: "re_SECRETVALUE", CLOUDFLARE_R2_SECRET_ACCESS_KEY: "r2secretvalue", ADMIN_AUTH_SECRET: "x".repeat(40), NODE_ENV: "production" };
    const text = JSON.stringify(buildIntegrationChecks(env, last));
    for (const secret of ["SECRETSECRETSECRET", "re_SECRETVALUE", "r2secretvalue", "x".repeat(40)]) expect(text).not.toContain(secret);
    expect(stripeKeyFacts(env.STRIPE_SECRET_KEY)).toEqual({ present: true, mode: "live", restricted: false });
    expect(stripeKeyFacts("rk_test_abc")).toEqual({ present: true, mode: "test", restricted: true });
    expect(stripeKeyFacts("")).toEqual({ present: false, mode: "unknown", restricted: false });
  });

  it("flags a missing Stripe key as an error and a test key on production as a warning", () => {
    expect(byId(buildIntegrationChecks({ NODE_ENV: "production" }, last), "stripe").kind).toBe("crit");
    expect(byId(buildIntegrationChecks({ NODE_ENV: "production", STRIPE_SECRET_KEY: "sk_test_x" }, last), "stripe")).toMatchObject({ kind: "warn", detail: expect.stringContaining("TESTOWY") });
    expect(byId(buildIntegrationChecks({ NODE_ENV: "production", STRIPE_SECRET_KEY: "rk_live_x" }, last), "stripe").kind).toBe("ok");
  });

  it("lists exactly which R2 variables are missing and carries the last-seen timestamps", () => {
    const checks = buildIntegrationChecks({ CLOUDFLARE_R2_ACCOUNT_ID: "a" }, { ...last, paymentAt: new Date("2026-10-05T08:00:00Z") });
    expect(byId(checks, "r2")).toMatchObject({ kind: "warn", detail: expect.stringContaining("CLOUDFLARE_R2_ACCESS_KEY_ID") });
    expect(byId(checks, "stripe").lastAt).toBe("2026-10-05T08:00:00.000Z");
    expect(byId(checks, "access").kind).toBe("info");
    expect(byId(buildIntegrationChecks({ NODE_ENV: "production" }, last), "access").kind).toBe("crit");
  });
});
