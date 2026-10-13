import { describe, expect, it } from "vitest";
import {
  COVER_MAX_BYTES,
  TITLE_MAX,
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
    const baseline: EditorForm = { title: "A", titleEn: "", description: "", descriptionEn: "", tier: "PUBLIC", premiere: "" };
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
