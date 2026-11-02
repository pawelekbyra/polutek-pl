/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CAPTIONS_STORAGE_KEY,
  CAPTION_LANGUAGE_STORAGE_KEY,
  pickCaptionTrack,
  readCaptionLanguage,
  readCaptionsEnabled,
  writeCaptionLanguage,
  writeCaptionsEnabled,
} from "@/app/components/player/captions";

const PL = { kind: "subtitles", language: "pl", src: "/subtitles/v/pl.vtt" };
const EN = { kind: "subtitles", language: "en", src: "/subtitles/v/en.vtt" };

describe("pickCaptionTrack", () => {
  it("picks the track in the page language", () => {
    expect(pickCaptionTrack([PL, EN], "pl")).toBe(PL);
    expect(pickCaptionTrack([PL, EN], "en")).toBe(EN);
  });

  it("matches the primary language when the track carries a region", () => {
    const enGb = { kind: "captions", language: "en-GB", src: "/x.vtt" };
    expect(pickCaptionTrack([PL, enGb], "en")).toBe(enGb);
    expect(pickCaptionTrack([PL, EN, enGb], "en-GB")).toBe(enGb);
  });

  it("falls back to an available language when the page language is missing", () => {
    expect(pickCaptionTrack([PL], "en")).toBe(PL);
    expect(pickCaptionTrack([EN], "pl")).toBe(EN);
    expect(pickCaptionTrack([], "pl")).toBeNull();
  });

  it("prefers the viewer's saved subtitle language", () => {
    expect(pickCaptionTrack([PL, EN], "pl", "en")).toBe(EN);
    expect(pickCaptionTrack([PL], "en", "de")).toBe(PL);
  });

  it("ignores tracks that are not captions or subtitles", () => {
    expect(pickCaptionTrack([{ kind: "chapters", language: "pl", src: "/c.vtt" }], "pl")).toBeNull();
  });
});

describe("captions preference", () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    writeCaptionsEnabled(true);
  });

  it("is on by default", () => {
    expect(readCaptionsEnabled()).toBe(true);
  });

  it("remembers off and on in localStorage", () => {
    writeCaptionsEnabled(false);
    expect(localStorage.getItem(CAPTIONS_STORAGE_KEY)).toBe("off");
    expect(readCaptionsEnabled()).toBe(false);
    writeCaptionsEnabled(true);
    expect(localStorage.getItem(CAPTIONS_STORAGE_KEY)).toBeNull();
    expect(readCaptionsEnabled()).toBe(true);
  });

  it("remembers the selected subtitle language separately from on/off", () => {
    writeCaptionLanguage(" EN ");
    expect(localStorage.getItem(CAPTION_LANGUAGE_STORAGE_KEY)).toBe("en");
    expect(readCaptionLanguage()).toBe("en");
    expect(readCaptionsEnabled()).toBe(true);
  });

  it("still works for the page when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    writeCaptionsEnabled(false);
    expect(readCaptionsEnabled()).toBe(false);
  });
});
