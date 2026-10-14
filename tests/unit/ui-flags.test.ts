import { describe, expect, it } from "vitest";
import { SHOW_NOTIFICATION_BELL, SHOW_SUBSCRIPTION_BELL } from "@/lib/ui-flags";

describe("ui flags", () => {
  it("keeps the per-subscription bell hidden until the owner turns it on", () => {
    expect(SHOW_SUBSCRIPTION_BELL).toBe(false);
  });

  it("shows the notification bell in the top bar", () => {
    expect(SHOW_NOTIFICATION_BELL).toBe(true);
  });
});
