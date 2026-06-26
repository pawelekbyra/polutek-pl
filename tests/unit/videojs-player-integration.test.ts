import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const videoPlayer = () =>
  readFileSync("app/components/VideoPlayer.tsx", "utf8");
const videoJsPlayer = () =>
  readFileSync("app/components/VideoJsPlayer.tsx", "utf8");

describe("Video.js hero player integration", () => {
  it("routes normal hero playback through VideoJsPlayer instead of Vidstack custom controls", () => {
    const source = videoPlayer();

    expect(source).toContain('import VideoJsPlayer from "./VideoJsPlayer";');
    expect(source).toContain("<VideoJsPlayer");
    expect(source).not.toContain("@vidstack/react");
    expect(source).not.toContain("PolutekVideoControls");
    expect(source).not.toContain("PlayerTimeScrubber");
    expect(source).not.toContain("PlayerTapTarget");
  });

  it("keeps embeds separated from the Video.js path", () => {
    const source = videoPlayer();

    expect(source).toContain('resolvedSource.mode === "embed"');
    expect(source).toContain("<iframe");
    expect(source).toContain("allowFullScreen");
  });

  it("configures Video.js for responsive HLS playback and native controls", () => {
    const source = videoJsPlayer();

    expect(source).toContain('import videojs from "video.js";');
    expect(source).toContain('import "video.js/dist/video-js.css";');
    expect(source).toContain(
      'if (pathname.endsWith(".m3u8")) return "application/x-mpegURL";',
    );
    expect(source).toContain("fluid: true");
    expect(source).toContain("responsive: true");
    expect(source).toContain("controls,");
  });

  it("maps Video.js callbacks to existing playback tracking events", () => {
    const source = videoPlayer();

    for (const eventName of [
      "PLAYER_READY",
      "PLAY_STARTED",
      "PLAY_PAUSED",
      "ENDED",
      "SEEKED",
      "BUFFERING_STARTED",
      "BUFFERING_ENDED",
      "PLAYER_ERROR",
      "WATCHED_10_SECONDS",
      "WATCHED_25_PERCENT",
      "WATCHED_50_PERCENT",
      "WATCHED_75_PERCENT",
      "WATCHED_90_PERCENT",
      "HEARTBEAT",
    ]) {
      expect(source).toContain(eventName);
    }
  });
});
