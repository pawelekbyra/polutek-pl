import { describe, expect, it } from "vitest";
import { SHOW_NOTIFICATION_BELL, SHOW_SUBSCRIPTION_BELL } from "@/lib/ui-flags";

describe("ui flags", () => {
  it("keeps both notification bells hidden until the owner turns them on", () => {
    expect(SHOW_SUBSCRIPTION_BELL).toBe(false);
    expect(SHOW_NOTIFICATION_BELL).toBe(false);
  });
});
