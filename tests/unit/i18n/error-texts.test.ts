import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadCatalog } from "@/lib/i18n/catalog";
import { createTx } from "@/lib/i18n/ui";
import { commentErrorText } from "@/app/components/comments/comment-errors";
import { StudioApiError } from "@/app/components/studio/studio-client";
import { studioErrorText } from "@/app/components/studio/studio-errors";

const PL = "Kanał może mieć najwyżej 100 playlist.";

describe("S04: Studio API errors are shown by code, in the interface language", () => {
  it("maps a known code to the viewer's language, with the numeric limit as a parameter", async () => {
    const error = new StudioApiError("Kanał może mieć najwyżej 100 playlist.", 409, "PLAYLIST_LIMIT");
    expect(studioErrorText(error, createTx("pl"), "x")).toBe(PL);
    expect(studioErrorText(error, createTx("en"), "x")).toBe("A channel can have at most 100 playlists.");
    const de = createTx("de", (await loadCatalog("de")) ?? {});
    expect(studioErrorText(error, de, "x")).toBe("Ein Kanal kann höchstens 100 Playlists haben.");
  });

  it("never shows the server's Polish message outside the Polish interface", async () => {
    const unknown = new StudioApiError("Jakiś polski komunikat serwera.", 400, "SOMETHING_NEW");
    expect(studioErrorText(unknown, createTx("pl"), "Fallback PL")).toBe("Jakiś polski komunikat serwera.");
    for (const language of ["en", "de", "fr", "zh"] as const) {
      const tx = createTx(language, (await loadCatalog(language)) ?? {});
      expect(studioErrorText(unknown, tx, "Fallback")).toBe("Fallback");
    }
  });

  it("falls back to the HTTP status, then to the caller's translated text", () => {
    const en = createTx("en");
    expect(studioErrorText(new StudioApiError("Błąd", 403), en, "x")).toBe("You do not have permission to do this.");
    expect(studioErrorText(new StudioApiError("Błąd", 503), en, "x")).toBe("Server error. Please try again.");
    expect(studioErrorText(new TypeError("Failed to fetch"), en, "Could not save the changes.")).toBe("Could not save the changes.");
  });

  it("covers the codes the upload client raises itself (they were hard-coded Polish)", () => {
    const en = createTx("en");
    for (const code of ["ABORTED", "PART_FAILED", "PART_ETAG_MISSING"]) {
      expect(studioErrorText(new StudioApiError("Polski", 502, code), en, "x")).not.toBe("x");
    }
  });

  it("no Studio component shows StudioApiError.message directly any more", () => {
    const dir = join(process.cwd(), "app/components/studio");
    const offenders = readdirSync(dir)
      .filter((file) => /\.tsx?$/.test(file) && file !== "studio-errors.ts")
      .filter((file) => /instanceof StudioApiError\s*\?\s*\w+\.message/.test(readFileSync(join(dir, file), "utf8")));
    expect(offenders).toEqual([]);
  });
});

describe("S05: comment errors are shown by code, never as the server's text", () => {
  it("translates the codes the comments API really returns (incl. ban and disabled comments)", async () => {
    const fr = createTx("fr", (await loadCatalog("fr")) ?? {});
    for (const code of ["AUTH_REQUIRED", "COMMENT_FORBIDDEN", "CHANNEL_BANNED", "COMMENTS_DISABLED", "COMMENT_PAYLOAD_TOO_LARGE", "COMMENT_RATE_LIMITED"]) {
      const text = commentErrorText({ code, status: 403 }, fr, "FALLBACK");
      expect(text).not.toBe("FALLBACK");
      expect(text).not.toMatch(/[ąćęłńóśźż]/i); // no Polish leaked into the French interface
    }
    expect(commentErrorText({ code: "COMMENTS_DISABLED" }, createTx("en"), "x")).toBe("Comments on this video are turned off.");
    expect(commentErrorText({ code: "CHANNEL_BANNED" }, createTx("pl"), "x")).toBe("Nie możesz komentować filmów tego kanału.");
  });

  it("an unknown code or a plain Error (e.g. 'Request failed with status 500') shows the translated fallback", () => {
    const en = createTx("en");
    expect(commentErrorText({ code: "COMMENT_ERROR", status: 500 }, en, "Failed to add comment.")).toBe("Failed to add comment.");
    expect(commentErrorText(new Error("Request failed with status 500"), en, "Could not save your changes.")).toBe("Could not save your changes.");
    expect(commentErrorText(undefined, en, "x")).toBe("x");
  });

  it("uses the status for sign-in and rate limits when there is no code", () => {
    const en = createTx("en");
    expect(commentErrorText({ status: 401 }, en, "x")).toBe("You must be signed in to comment.");
    expect(commentErrorText({ status: 429 }, en, "x")).toBe("Too many comments. Try again in a moment.");
  });

  it("the three places that showed error.message now go through commentErrorText", () => {
    for (const file of [
      "app/components/comments/EmbeddedComments.tsx",
      "app/components/comments/components/CommentItem.tsx",
      "app/components/comments/components/ReportDialog.tsx",
    ]) {
      const source = readFileSync(join(process.cwd(), file), "utf8");
      expect(source).toContain("commentErrorText(");
      expect(source).not.toMatch(/(error|submitError)\.message/);
    }
  });
});
