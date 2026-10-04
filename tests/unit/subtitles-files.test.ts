import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Caption files served by the app (public/subtitles/<slug>/<lang>.vtt). Each video folder must be
// listed here with its real length in seconds (sum of #EXTINF in its HLS playlist).
const VIDEO_DURATION_SECONDS: Record<string, number> = {
  czesc: 10.0,
};

const ROOT = path.resolve(__dirname, "../../public/subtitles");

type Cue = { start: number; end: number; text: string };

function toSeconds(stamp: string): number {
  const match = /^(?:(\d{2,}):)?(\d{2}):(\d{2})\.(\d{3})$/.exec(stamp);
  if (!match) throw new Error(`bad timestamp ${stamp}`);
  const [, h = "0", m, s, ms] = match;
  return Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms) / 1000;
}

/** Minimal WebVTT reader for our own files: header, NOTE blocks, optional cue ids, cues. */
function parseVtt(source: string): Cue[] {
  const text = source.replace(/\r\n/g, "\n");
  if (text.charCodeAt(0) === 0xfeff) throw new Error("file starts with a BOM");
  const blocks = text.split(/\n{2,}/);
  if (!/^WEBVTT(?:[ \t].*)?$/.test(blocks[0].split("\n")[0])) throw new Error("missing WEBVTT header");
  const cues: Cue[] = [];
  for (const block of blocks.slice(1)) {
    const lines = block.split("\n").filter((line) => line.length > 0);
    if (lines.length === 0 || lines[0].startsWith("NOTE")) continue;
    const timingIndex = lines.findIndex((line) => line.includes("-->"));
    if (timingIndex < 0 || timingIndex > 1) throw new Error(`block without timing: ${block}`);
    const [start, end] = lines[timingIndex].split("-->").map((part) => toSeconds(part.trim().split(/\s+/)[0]));
    const cueText = lines.slice(timingIndex + 1).join("\n");
    if (!cueText.trim()) throw new Error(`empty cue at ${lines[timingIndex]}`);
    cues.push({ start, end, text: cueText });
  }
  return cues;
}

const videos = readdirSync(ROOT, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name);

describe("caption files in public/subtitles", () => {
  it("every video folder has a known length", () => {
    expect(videos.length).toBeGreaterThan(0);
    for (const video of videos) expect(VIDEO_DURATION_SECONDS[video], video).toBeGreaterThan(0);
  });

  for (const video of videos) {
    const files = readdirSync(path.join(ROOT, video)).filter((name) => name.endsWith(".vtt"));

    it(`${video}: has Polish and English captions`, () => {
      expect(files.sort()).toEqual(["en.vtt", "pl.vtt"]);
    });

    for (const file of files) {
      it(`${video}/${file}: valid cues, rising and not overlapping, within the video`, () => {
        const cues = parseVtt(readFileSync(path.join(ROOT, video, file), "utf8"));
        expect(cues.length).toBeGreaterThan(0);
        let previousEnd = 0;
        for (const cue of cues) {
          expect(cue.start).toBeGreaterThanOrEqual(previousEnd);
          expect(cue.end).toBeGreaterThan(cue.start);
          previousEnd = cue.end;
        }
        expect(previousEnd).toBeLessThanOrEqual(VIDEO_DURATION_SECONDS[video]);
      });
    }

    it(`${video}: English is a cue-for-cue translation of Polish (same timings)`, () => {
      const read = (lang: string) => parseVtt(readFileSync(path.join(ROOT, video, `${lang}.vtt`), "utf8"));
      const timings = (cues: Cue[]) => cues.map(({ start, end }) => [start, end]);
      expect(timings(read("en"))).toEqual(timings(read("pl")));
    });
  }

  it("the reader rejects broken files", () => {
    expect(() => parseVtt("00:00:01.000 --> 00:00:02.000\nx")).toThrow();
    expect(() => parseVtt("WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n")).toThrow();
    expect(() => parseVtt("WEBVTT\n\n00:01.0 --> 00:02.000\nx")).toThrow();
  });
});
