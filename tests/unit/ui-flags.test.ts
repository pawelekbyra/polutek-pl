import { describe, expect, it } from "vitest";
import { SHOW_SUBSCRIPTION_BELL } from "@/lib/ui-flags";

describe("ui flags", () => {
  it("shows the per-subscription bell (back together with the notification bell)", () => {
    expect(SHOW_SUBSCRIPTION_BELL).toBe(true);
  });
});
