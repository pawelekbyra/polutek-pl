import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8");

describe("accessibility audit fixes: focus and announcements (static)", () => {
  it("A10: the phone search returns focus to its opening button and closes on Escape", () => {
    const navbar = read("app/components/Navbar.tsx");
    expect(navbar).toContain("searchTriggerRef");
    expect(navbar).toContain("restoreSearchFocusRef");
    expect(navbar).toMatch(/event\.key === "Escape"\) closeMobileSearch\(\)/);
    expect(navbar).toContain("onClick={closeMobileSearch}");
    expect(navbar).not.toContain("onClick={() => setIsMobileSearchOpen(false)}");
  });

  it("A11: ChannelHome announces a switched video in a status region and Hero's title can take focus", () => {
    const home = read("app/components/ChannelHome.tsx");
    expect(home).toMatch(/role="status" aria-live="polite" aria-atomic="true" className="sr-only"/);
    expect(home).toContain('document.getElementById("video-title")');
    expect(home).toContain("focusTitleRef.current = !auto");
    expect(read("app/components/Hero.tsx")).toMatch(/<h1 id="video-title" tabIndex=\{-1\}/);
    // Automatic hand-over in a playlist never moves the focus.
    expect(read("app/components/playlists/PlaylistQueuePanel.tsx")).toContain("onAdvance={(index) => select(index, true)}");
  });

  it("A14: player error and blocked-state overlays are announced (alert for failures, status otherwise)", () => {
    expect(read("app/components/PlayerErrorOverlay.tsx")).toMatch(/<div role="alert" className="absolute inset-0/);
    expect(read("app/components/PremiumWrapper.tsx")).toContain('role={safeState === "ERROR" || safeState === "UNAVAILABLE" ? "alert" : "status"}');
  });

  it("A21: the sign-in window and the upload wizard move focus to the new heading/step marker", () => {
    expect(read("app/components/auth/AuthDialogTop.tsx")).toMatch(/titleRef\.current\?\.focus\(/);
    expect(read("app/components/auth/AuthModal.tsx")).toContain("viewKey={view}");
    const wizard = read("app/components/studio/StudioUploadWizard.tsx");
    expect(wizard).toContain("currentStepRef.current?.focus(");
    expect(wizard).toContain("ref={step === s.id ? currentStepRef : undefined}");
  });
});
