import { describe, expect, it } from "vitest";
import {
  COVER_MAX_BYTES,
  TAGS_MAX,
  TAG_MAX_LENGTH,
  TITLE_MAX,
  addTagsFromInput,
  removeTag,
  tagCounterText,
  buildVideoListQuery,
  isFormDirty,
  titleFromFileName,
  toLocalInput,
  validateCoverFile,
  visibilityToFields,
  type EditorForm,
} from "@/app/components/studio/video-form";
import { createVideoSchema, studioVideosQuerySchema, updateVideoSchema } from "@/lib/api/studio-schemas";

const now = new Date("2026-10-13T12:00:00");

describe("visibilityToFields", () => {
  it("private is a plain draft", () => {
    expect(visibilityToFields("private", "", now)).toEqual({ ok: true, fields: { publishAfterAssetReady: false, premiereAt: null } });
  });

  it("private ignores a leftover date", () => {
    expect(visibilityToFields("private", "2027-01-01T10:00", now)).toEqual({
      ok: true,
      fields: { publishAfterAssetReady: false, premiereAt: null },
    });
  });

  it("auto publishes after processing without a date", () => {
    expect(visibilityToFields("auto", "2027-01-01T10:00", now)).toEqual({ ok: true, fields: { publishAfterAssetReady: true, premiereAt: null } });
  });

  it("scheduled needs a future date and sends an ISO instant", () => {
    const result = visibilityToFields("scheduled", "2026-12-01T18:30", now);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.fields.publishAfterAssetReady).toBe(true);
      expect(result.fields.premiereAt).toBe(new Date("2026-12-01T18:30").toISOString());
    }
  });

  it("rejects an empty, invalid or past schedule", () => {
    expect(visibilityToFields("scheduled", "", now)).toEqual({ ok: false, reason: "PREMIERE_REQUIRED" });
    expect(visibilityToFields("scheduled", "nonsense", now)).toEqual({ ok: false, reason: "PREMIERE_INVALID" });
    expect(visibilityToFields("scheduled", "2026-10-13T11:00", now)).toEqual({ ok: false, reason: "PREMIERE_PAST" });
  });
});

describe("limits and helpers", () => {
  it("derives a title from the file name within the limit", () => {
    expect(titleFromFileName("moj_film-2026.mp4")).toBe("moj film 2026");
    expect(titleFromFileName(`${"a".repeat(300)}.mp4`)).toHaveLength(TITLE_MAX);
  });

  it("validates a thumbnail by type and size", () => {
    expect(validateCoverFile({ type: "image/png", size: 10 })).toBeNull();
    expect(validateCoverFile({ type: "image/gif", size: 10 })).toBe("TYPE");
    expect(validateCoverFile({ type: "image/webp", size: COVER_MAX_BYTES + 1 })).toBe("SIZE");
  });

  it("builds the list query leaving defaults out", () => {
    const base = { q: "", status: "ALL" as const, sort: "newest" as const, page: 1, limit: 20 };
    expect(buildVideoListQuery(base)).toBe("limit=20");
    expect(buildVideoListQuery({ ...base, q: "  kot ", status: "DRAFT", sort: "views", page: 3 })).toBe(
      "q=kot&status=DRAFT&sort=views&page=3&limit=20",
    );
  });

  it("detects unsaved changes against the baseline", () => {
    const baseline: EditorForm = { title: "A", titleEn: "", description: "", descriptionEn: "", tier: "PUBLIC", premiere: "", tags: [], category: "", commentsMode: "ON" };
    expect(isFormDirty(baseline, baseline)).toBe(false);
    expect(isFormDirty({ ...baseline }, baseline)).toBe(false);
    expect(isFormDirty({ ...baseline, description: "x" }, baseline)).toBe(true);
    expect(isFormDirty(baseline, null)).toBe(false);
  });

  it("formats a premiere for a datetime-local input", () => {
    expect(toLocalInput(null)).toBe("");
    expect(toLocalInput("not a date")).toBe("");
    expect(toLocalInput(new Date(2026, 11, 1, 18, 5).toISOString())).toBe("2026-12-01T18:05");
  });
});

describe("Studio schemas", () => {
  it("enforces 100 characters for the title and 5000 for the description", () => {
    expect(createVideoSchema.safeParse({ title: "a".repeat(100) }).success).toBe(true);
    expect(createVideoSchema.safeParse({ title: "a".repeat(101) }).success).toBe(false);
    expect(createVideoSchema.safeParse({ title: "t", description: "d".repeat(5000) }).success).toBe(true);
    expect(createVideoSchema.safeParse({ title: "t", description: "d".repeat(5001) }).success).toBe(false);
    expect(updateVideoSchema.safeParse({ description: "d".repeat(5001) }).success).toBe(false);
  });

  it("accepts the visibility fields of the wizard and rejects a non-ISO premiere", () => {
    expect(createVideoSchema.safeParse({ title: "t", publishAfterAssetReady: true, premiereAt: "2026-12-01T18:00:00.000Z" }).success).toBe(true);
    expect(createVideoSchema.safeParse({ title: "t", premiereAt: "jutro" }).success).toBe(false);
    expect(createVideoSchema.safeParse({ title: "t", publishAfterAssetReady: "yes" }).success).toBe(false);
  });

  it("whitelists the list filters", () => {
    expect(studioVideosQuerySchema.safeParse({ q: "kot", status: "DRAFT", sort: "views" }).success).toBe(true);
    expect(studioVideosQuerySchema.safeParse({ status: "REMOVED" }).success).toBe(false);
    expect(studioVideosQuerySchema.safeParse({ sort: "title; DROP" }).success).toBe(false);
    expect(studioVideosQuerySchema.safeParse({ q: "x".repeat(101) }).success).toBe(false);
  });
});

describe("tags input", () => {
  it("adds tags separated by a comma or a new line, without # and duplicates", () => {
    const result = addTagsFromInput(["kot"], "#pies, Kot,\n mysz ,,");
    expect(result).toEqual({ tags: ["kot", "pies", "mysz"], leftover: "", problem: null });
  });

  it("keeps a too long tag in the input and reports why", () => {
    const long = "a".repeat(TAG_MAX_LENGTH + 1);
    const result = addTagsFromInput([], `ok, ${long}`);
    expect(result.tags).toEqual(["ok"]);
    expect(result.leftover).toBe(long);
    expect(result.problem).toBe("TOO_LONG");
  });

  it("stops at the maximum count and keeps the rest", () => {
    const full = Array.from({ length: TAGS_MAX - 1 }, (_, i) => `t${i}`);
    const result = addTagsFromInput(full, "one, two");
    expect(result.tags).toHaveLength(TAGS_MAX);
    expect(result.leftover).toBe("two");
    expect(result.problem).toBe("TOO_MANY");
    expect(tagCounterText(result.tags)).toBe(`${TAGS_MAX}/${TAGS_MAX}`);
  });

  it("removes a tag by index and treats tag changes as unsaved work", () => {
    expect(removeTag(["a", "b", "c"], 1)).toEqual(["a", "c"]);
    const baseline: EditorForm = { title: "A", titleEn: "", description: "", descriptionEn: "", tier: "PUBLIC", premiere: "", tags: ["a"], category: "", commentsMode: "ON" };
    expect(isFormDirty({ ...baseline, tags: ["a"] }, baseline)).toBe(false);
    expect(isFormDirty({ ...baseline, tags: ["a", "b"] }, baseline)).toBe(true);
    expect(isFormDirty({ ...baseline, commentsMode: "OFF" }, baseline)).toBe(true);
  });
});

describe("Studio schemas: metadata whitelists", () => {
  it("accepts known categories and modes, rejects anything else", () => {
    expect(updateVideoSchema.safeParse({ category: "music", commentsMode: "HELD", tags: ["a"] }).success).toBe(true);
    expect(updateVideoSchema.safeParse({ category: null }).success).toBe(true);
    expect(updateVideoSchema.safeParse({ category: "cats" }).success).toBe(false);
    expect(updateVideoSchema.safeParse({ commentsMode: "ALL" }).success).toBe(false);
    expect(createVideoSchema.safeParse({ title: "t", commentsMode: "off" }).success).toBe(false);
  });

  it("limits tags to 15 of 30 characters and normalizes them", () => {
    const parsed = updateVideoSchema.safeParse({ tags: ["#Kot", "kot", " pies "] });
    expect(parsed.success && parsed.data.tags).toEqual(["Kot", "pies"]);
    expect(updateVideoSchema.safeParse({ tags: ["a".repeat(31)] }).success).toBe(false);
    expect(updateVideoSchema.safeParse({ tags: Array.from({ length: 16 }, (_, i) => `t${i}`) }).success).toBe(false);
    expect(updateVideoSchema.safeParse({ tags: Array.from({ length: 15 }, (_, i) => `t${i}`) }).success).toBe(true);
  });
});
