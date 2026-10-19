import { describe, expect, it } from "vitest";
import { tabFromLocation } from "@/app/components/channel/ChannelTabs";

describe("tabFromLocation", () => {
  it("opens About from ?tab=about or #about and Videos otherwise", () => {
    expect(tabFromLocation("?tab=about", "")).toBe("about");
    expect(tabFromLocation("", "#about")).toBe("about");
    expect(tabFromLocation("?tab=videos", "")).toBe("videos");
    expect(tabFromLocation("?tab=%3Cscript%3E", "#x")).toBe("videos");
    expect(tabFromLocation("", "")).toBe("videos");
  });
});
