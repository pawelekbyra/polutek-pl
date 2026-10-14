import { describe, expect, it } from "vitest";
import { SHOW_SUBSCRIPTION_BELL } from "@/lib/ui-flags";

describe("ui flags", () => {
  it("keeps the subscription bell hidden until the owner turns it on", () => {
    expect(SHOW_SUBSCRIPTION_BELL).toBe(false);
  });
});
