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

  it("preserves the #1124 player controls and text-track contract", () => {
    const player = read("app/components/VideoPlayer.tsx");

    expect(player).toContain("Captions,");
    expect(player).toContain("function DoodleCaptionButton");
    expect(player).toContain("function DoodlePlayerControls({ hasTextTracks }");
    expect(player).toContain("{hasTextTracks && <DoodleCaptionButton");
    expect(player).toContain("export type VideoTextTrackDTO");
    expect(player).toContain("export function isTrackCaptionKind");
    expect(player).toContain("export function normalizeTextTracks");
    expect(player).toContain("playerConfig as { textTracks?: unknown }");
    expect(player).toContain("video as VideoType & { textTracks?: unknown }");
    expect(player).toContain("<Captions className=");
    expect(player).toContain("DoodleSettingsPlaceholder");
  });

  it("renders channel grid thumbnails from safe summary data without mounting PremiumWrapper or VideoPlayer", () => {
    const card = read("app/components/ChannelVideoCard.tsx");

    expect(card).not.toContain("PremiumWrapper");
    expect(card).not.toContain("VideoPlayer");
    expect(card).not.toContain("/api/media-source");
    expect(card).toContain("const hasAccess = clientHasAccess;");
    expect(card).toContain("!hasAccess &&");
    expect(card).toContain("badge?.text");
  });

  it("shows visible access CTAs for both full and compact lock states without framer infinite motion", () => {
    const overlay = read("app/components/AccessLockOverlay.tsx");

    expect(overlay).toContain("Zaloguj się");
    expect(overlay).toContain("Wesprzyj jednorazowo");
    expect(overlay).toContain('href="#support"');
    expect(overlay).toContain("support-box");
    expect(overlay).toContain("Zaloguj");
    expect(overlay).toContain("Wesprzyj");
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

  it("keeps SupportBox errors associated and pending state readable", () => {
    const support = read("app/components/playlist/SupportBox.tsx");

    expect(support).toContain("aria-invalid={amountTooLow}");
    expect(support).toContain(
      "aria-describedby={amountTooLow ? amountErrorId : undefined}",
    );
    expect(support).toContain('role="alert"');
    expect(support).toContain("aria-busy={isLoading}");
    expect(support).toContain("Processing...");
    expect(support).toContain("motion-reduce:animate-none");
    expect(support).not.toContain("animate-bounce");
  });
});
