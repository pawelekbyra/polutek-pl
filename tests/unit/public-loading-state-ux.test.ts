import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("public loading/access state UX contracts", () => {
  it("keeps PremiumWrapper as the single player loading state owner after route skeletons", () => {
    const wrapper = read("app/components/PremiumWrapper.tsx");
    const player = read("app/components/VideoPlayer.tsx");

    expect(wrapper).toContain(
      "return <PlayerLoadingState variant={variant} />;",
    );
    expect(wrapper).not.toContain("setMounted(true)");
    expect(player).toContain(
      "PremiumWrapper owns the single player loading placeholder",
    );
    expect(player).toMatch(
      /if \(!isMounted \|\| isLoading\) \{\s*return null;\s*\}/,
    );
    expect(player).not.toContain("<PlayerLoadingState");
  });

  it("keeps the public player controls clean, accessible, and compact", () => {
    const player = read("app/components/VideoPlayer.tsx");

    expect(player).toContain("function PlayerCaptionButton");
    expect(player).toContain("function PolutekVideoControls({ hasTextTracks }");
    expect(player).toContain("<PlayerCaptionButton className={buttonClass} disabled={!hasTextTracks} />");
    expect(player).not.toContain("Settings");
    expect(player).toContain("const playerIconClass = \"h-[1.25rem] w-[1.25rem]\";");
    expect(player).not.toContain("const doodleIconClass");
    expect(player).not.toContain("drop-shadow-[1.5px_1.5px_0_rgba(14,165,233,0.45)]");
    expect(player).not.toContain("bg-gradient-to-r from-sky-400 via-blue-500 to-amber-300");
    expect(player).not.toContain("rounded-full border border-white/15 bg-black/35");
    expect(player).toContain("inline-flex min-w-[5.75rem] shrink-0 items-center gap-1 whitespace-nowrap");
    expect(player).toContain("text-[12px] font-semibold");
    expect(player).toContain("sm:min-w-[8.5rem] sm:text-[15px]");
    // Progress bar now uses Vidstack's built-in TimeSlider, which handles seeking correctly —
    // including seeking after the video has ended — instead of the hand-rolled scrubber.
    expect(player).toContain("<TimeSlider.Root");
    expect(player).toContain("<TimeSlider.Track");
    expect(player).toContain("<TimeSlider.TrackFill");
    expect(player).toContain("<TimeSlider.Thumb");
    expect(player).not.toContain("function PlayerTimeScrubber");
    expect(player).not.toContain("optimisticSeekTime");
    expect(player).not.toContain("pendingSeekTime");
    expect(player).not.toContain("--slider-fill");
    expect(player).toContain("PROGRESS_PLAYED_COLOR");
    expect(player).not.toContain("remote.seeking(clampedTime");
    expect(player).toContain("event.stopPropagation()");
    expect(player).toContain("bg-white/85");
    expect(player).toContain("group-hover/tslider:h-[5px]");
    expect(player).not.toContain("group-data-[active]/slider:h-2.5");
    expect(player).not.toContain("before:-inset-3");
    expect(player).not.toContain("hidden h-10 w-24 shrink-0 items-center md:flex");
    // Compact, YouTube-sized control buttons in a tight row under the bar.
    expect(player).toContain("grid h-8 w-8 shrink-0 place-items-center");
    expect(player).toContain("sm:h-9 sm:w-9");
    expect(player).toContain('aria-label={paused ? "Odtwórz" : "Pauza"}');
    expect(player).toContain('aria-label="Wycisz / włącz dźwięk"');
    expect(player).toContain('aria-label={captionsOn ? "Wyłącz napisy" : "Włącz napisy"}');
    expect(player).toContain('aria-label="Pełny ekran"');

    const videoTypes = read("app/types/video.ts");
    expect(player).toContain("type VideoTextTrackDTO");
    expect(videoTypes).toContain("export type VideoTextTrackDTO");
    expect(player).toContain("<Captions className=");
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

  it("shows visible access CTAs for both full and compact lock states without framer infinite motion", () => {
    const overlay = read("app/components/AccessLockOverlay.tsx");

    expect(overlay).toContain("Zaloguj się");
    expect(overlay).toContain("Wesprzyj kanał");
    expect(overlay).toContain('href="#donations"');
    expect(overlay).toContain('getElementById("donations")');
    expect(overlay).toContain("Zaloguj");
    expect(overlay).not.toContain("framer-motion");
    expect(overlay).not.toContain("repeat: Infinity");
    expect(overlay).not.toContain("text-transparent");
  });

  it("keeps comments neutral while loading and exposes readable pending labels", () => {
    const embedded = read("app/components/comments/EmbeddedComments.tsx");
    const composer = read(
      "app/components/comments/components/CommentComposer.tsx",
    );

    expect(embedded).toContain("isViewerLoading={isLoading}");
    expect(embedded).toContain('<Skeleton className="h-7 w-48" />');
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
    expect(content).toContain('useState<Language>(initialLanguage ?? "pl")');
    expect(content).not.toMatch(/useState<Language>\(\(\) =>/);
    expect(content).toContain("useEffect(() => {");
    expect(content).toContain("localStorage.getItem('app-language')");
  });
});
