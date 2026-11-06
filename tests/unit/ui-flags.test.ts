import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BRAND_LOGO_VARIANT, SHOW_NOTIFICATION_BELL, SHOW_SUBSCRIPTION_BELL } from "@/lib/ui-flags";
import { VARIANT_ASSETS } from "../../scripts/brand/set-logo.mjs";

describe("ui flags", () => {
  it("keeps the per-subscription bell hidden until the owner turns it on", () => {
    expect(SHOW_SUBSCRIPTION_BELL).toBe(false);
  });

  it("shows the notification bell in the top bar", () => {
    expect(SHOW_NOTIFICATION_BELL).toBe(true);
  });

  it("the header logo switch names a declared variant whose files exist (npm run logo -- <variant> keeps this true)", () => {
    const flags = readFileSync(path.join(process.cwd(), "lib/ui-flags.ts"), "utf8");
    const declared = [...(flags.match(/export type BrandLogoVariant =([^;]+);/)?.[1] ?? "").matchAll(/"([a-z-]+)"/g)].map((m) => m[1]);

    expect(declared).toEqual(expect.arrayContaining(["wordmark-blue-symbol", "wordmark-blue-symbol-orbit", "wordmark-blue", "wordmark", "glasses"]));
    expect(declared).toContain(BRAND_LOGO_VARIANT);
    for (const v of declared) {
      for (const f of (VARIANT_ASSETS as Record<string, string[]>)[v] ?? ["(no assets listed for " + v + ")"]) expect(existsSync(path.join(process.cwd(), f)), f).toBe(true);
    }
  });
});
