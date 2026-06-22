import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("getSafePlaybackState logic priority source check", () => {
  it("has the correct order of operations in the source code", () => {
    const source = readFileSync("app/components/PremiumWrapper.tsx", "utf8");

    const apiStateCheckIndex = source.indexOf("const state = candidates.find(");
    const hasAccessCheckIndex = source.indexOf("if (data?.hasAccess === true");
    const anonymousDeniedCheckIndex = source.indexOf("if (anonymousDenied) {");

    expect(apiStateCheckIndex).toBeGreaterThan(-1);
    expect(hasAccessCheckIndex).toBeGreaterThan(apiStateCheckIndex);
    expect(anonymousDeniedCheckIndex).toBeGreaterThan(hasAccessCheckIndex);
  });
});
