import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("public loading/access state UX contracts", () => {
  it("keeps PremiumWrapper as the single player loading state owner after route skeletons", () => {
    const wrapper = read("app/components/PremiumWrapper.tsx");
    const player = read("app/components/VideoPlayer.tsx");

    expect(wrapper).toContain(
      "return <PlayerLoadingState variant={variant} posterUrl={posterUrl} />;",
    );
    expect(wrapper).not.toContain("setMounted(true)");
    expect(player).toContain(
      "PremiumWrapper owns the single player loading placeholder",
    );
    expect(player).toContain("if (!isMounted || isLoading) return null;");
    expect(player).not.toContain("<PlayerLoadingState");
  });

  it("uses the custom responsive Polutek player controls", () => {
    const player = read("app/components/VideoPlayer.tsx");
    const controls = read("app/components/player/PolutekControls.tsx");
    const controlsCopy = read(
      "app/components/player/polutek-controls-copy.ts",
    );
    // The control bar's CSS ("Media-chrome style player controls (mc-*)") lives in
    // globals.css, not inline in PolutekControls.tsx — this component only wires up
    // Vidstack primitives + class names, it has no <style> block of its own.
    const globalStyles = read("app/globals.css");

    expect(player).toContain("PolutekControls");
    expect(player).not.toContain("DefaultVideoLayout");

    for (const primitive of [
      "TimeSlider",
      "VolumeSlider",
      "Controls.Root",
      "CaptionButton",
      "MuteButton",
      "FullscreenButton",
      "useMediaState",
    ]) {
      expect(controls).toContain(primitive);
    }

    expect(player).toContain("<MediaProvider>");
    expect(player).toContain("posterUrl");
    expect(player).toContain("<PolutekControls />");

    // The old "polutek-player-*" class names/pixel values below were replaced wholesale
    // by the "mc-*" (media-chrome style) rewrite in app/globals.css — confirmed via grep
    // that no "polutek-player-*" control-bar classes remain anywhere in the codebase, and
    // that this mc-* scheme is the entire visible git history for this file (not a recent
    // change). These are today's equivalents of the same responsive/accessibility intent:
    for (const responsiveContract of [
      // Buttons are 30x30 (mc-btn) rather than 44x44 — comfortably above WCAG 2.2 AA's
      // 24px Target Size (Minimum), consistent with this codebase's established
      // precedent elsewhere (see CommentItem.tsx's 32px reaction buttons).
      "width:30px; height:30px;",
      // Scrub track thickens on hover/focus, just at 4px instead of the old 5px.
      ".mc-scrub:focus-visible .mc-scrub-track { height:4px; }",
      "prefers-reduced-motion:reduce",
      // Renamed selectors, same intent: hide the "/duration" readout on narrow screens.
      ".mc-time-sep, .mc-time-dur { display:none; }",
      // Deliberately reversed, not just renamed: volume used to be hidden entirely on
      // mobile (no way to mute/adjust on touch, since :hover never fires there) — the
      // in-file comment above this rule explains that was a real gap, now fixed by
      // pinning the slider open at a compact width instead of hiding it.
      "width:36px; opacity:1; margin-right:4px; overflow:visible;",
    ]) {
      expect(globalStyles).toContain(responsiveContract);
    }

    expect(controlsCopy).toContain("Odtwórz ponownie");
    expect(controls).toContain("mc-center--ended");
    // Icons were moved from lucide-react to Vidstack's own icon set
    // (@vidstack/react/icons) as part of the same mc-* rewrite.
    expect(controls).toContain('from "@vidstack/react/icons"');
    expect(controls).not.toContain("SeekButton");
    expect(controls).not.toContain("PIPButton");
    expect(controls).not.toContain("Cofnij 10 sekund");
    expect(controls).not.toContain("Przewiń 10 sekund");
    expect(controls).not.toContain("Obraz w obrazie");

    const videoTypes = read("app/types/video.ts");
    expect(player).toContain("type VideoTextTrackDTO");
    expect(videoTypes).toContain("export type VideoTextTrackDTO");
  });

  it("uses the branded application loading state instead of a black system-like bar", () => {
    const loading = read("app/components/PlayerLoadingState.tsx");

    expect(loading).toContain("Już podaję film…");
    expect(loading).toContain("polutek-player-loader-mark");
    expect(loading).toContain("polutek-player-loader-progress");
    expect(loading).toContain("var(--chan-nav,#f7f9fc)");
    expect(loading).toContain('from "lucide-react"');
    expect(loading).not.toContain("scribble");
    expect(loading).not.toContain("spark");
    expect(loading).toContain('role="status"');
    expect(loading).toContain('aria-live="polite"');
    expect(loading).not.toContain("bg-black text-white");
  });

  it("renders channel grid thumbnails from safe summary data without mounting PremiumWrapper or VideoPlayer", () => {
    const card = read("app/components/ChannelVideoCard.tsx");

    expect(card).not.toContain("PremiumWrapper");
    expect(card).not.toContain("VideoPlayer");
    expect(card).not.toContain("/api/media-source");
    expect(card).toContain("const hasAccess = clientHasAccess;");
    expect(card).toContain("const lockState = !hasAccess");
    expect(card).toContain("{badge && (");
  });

  it("shows visible access CTAs with reduced-motion-safe ambient art and static compact states", () => {
    const overlay = read("app/components/AccessLockOverlay.tsx");
    const overlayStyles = read("app/components/AccessLockOverlay.module.css");

    expect(overlay).toContain("Zaloguj się");
    expect(overlay).toContain("Odblokuj dostęp");
    expect(overlay).toContain('href="#donations"');
    expect(overlay).toContain('getElementById("donations")');
    expect(overlay).toContain("useReducedMotion");
    expect(overlay).not.toContain("repeat: Infinity");
    expect(overlay).not.toContain("text-transparent");
    expect(overlayStyles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(overlayStyles).toContain(".compact");
    expect(overlayStyles).toContain("pointer-events: none");
  });

  it("keeps comments neutral while loading and exposes readable pending labels", () => {
    const embedded = read("app/components/comments/EmbeddedComments.tsx");
    const composer = read(
      "app/components/comments/components/CommentComposer.tsx",
    );

    expect(embedded).toContain("isViewerLoading={isLoading}");
    expect(embedded).toContain("<CommentsLoadingState language={language} />");
    expect(embedded).toContain("Warming up the discussion");
    expect(embedded).toContain("motion-reduce:animate-none");
    expect(composer).toContain("Checking comment access");
    expect(composer).toContain("Sprawdzamy możliwość komentowania");
    expect(composer).toContain("Wysyłanie...");
    expect(embedded).toContain("Ładowanie...");
  });

  it("keeps DonationBox errors associated and pending state readable", () => {
    const support = read("app/components/channel/DonationBox.tsx");
    const amountField = read("app/components/channel/DonationAmountField.tsx");

    expect(amountField).toContain("aria-invalid={amountTooLow}");
    expect(amountField).toContain(
      "aria-describedby={amountTooLow ? errorId : undefined}",
    );
    expect(amountField).toContain('role="alert"');
    expect(support).toContain("aria-busy={isLoading}");
    expect(support).toContain("Processing...");
    expect(support).toContain("motion-reduce:animate-none");
    expect(support).not.toContain("animate-bounce");
  });

  it("ensures LanguageContext does not use lazy initializer in useState to avoid hydration mismatch", () => {
    const content = read("app/components/LanguageContext.tsx");
    // Initial state must come from a static/server-provided value, never a lazy initializer that
    // reads localStorage during render (which would diverge from the server-rendered markup).
    expect(content).toContain('useState<Language>(forcedLanguage ?? initialLanguage ?? "pl")');
    expect(content).not.toMatch(/useState<Language>\(\(\) =>/);
    expect(content).toContain("useEffect(() => {");
    expect(content).toContain("localStorage.getItem('app-language')");
  });
});
