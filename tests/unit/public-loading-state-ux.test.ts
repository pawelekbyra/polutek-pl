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
    expect(player).toContain("if (!isMounted || isLoading) return null;");
    expect(player).not.toContain("<PlayerLoadingState");
  });

  it("uses the custom responsive Polutek player controls", () => {
    const player = read("app/components/VideoPlayer.tsx");
    const controls = read("app/components/player/PolutekControls.tsx");

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

    for (const responsiveContract of [
      "width:44px; height:44px;",
      "height:5px;",
      "env(safe-area-inset-bottom)",
      "prefers-reduced-motion:reduce",
      "polutek-player-time-duration,.polutek-player-time span { display:none; }",
      ".polutek-player-volume { display:none; }",
    ]) {
      expect(controls).toContain(responsiveContract);
    }

    expect(controls).toContain("Odtwórz ponownie");
    expect(controls).toContain("polutek-player-center--ended");
    expect(controls).toContain('from "lucide-react"');
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
    expect(loading).toContain("var(--chan-nav,#f7f1e4)");
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
    expect(content).toContain('useState<Language>(forcedLanguage ?? initialLanguage ?? "pl")');
    expect(content).not.toMatch(/useState<Language>\(\(\) =>/);
    expect(content).toContain("useEffect(() => {");
    expect(content).toContain("localStorage.getItem('app-language')");
  });
});
