import { describe, expect, it } from "vitest";
import { adminMultipartCompleteSchema, adminMultipartPartsSchema, adminMultipartStartSchema } from "@/lib/api/admin-schemas";

const ok = (schema: { safeParse: (v: unknown) => { success: boolean } }, value: unknown) => schema.safeParse(value).success;

describe("multipart upload body schemas (panel original-upload routes)", () => {
  it("start: needs a file name and a positive integer size", () => {
    expect(ok(adminMultipartStartSchema, { fileName: "a.mp4", fileSize: 10 })).toBe(true);
    expect(ok(adminMultipartStartSchema, { fileName: "", fileSize: 10 })).toBe(false);
    expect(ok(adminMultipartStartSchema, { fileName: "a.mp4", fileSize: 0 })).toBe(false);
    expect(ok(adminMultipartStartSchema, { fileName: "a.mp4", fileSize: 1.5 })).toBe(false);
  });

  it("parts: 1..50 part numbers within R2's 1..10000", () => {
    expect(ok(adminMultipartPartsSchema, { originalId: "o1", partNumbers: [1, 2] })).toBe(true);
    expect(ok(adminMultipartPartsSchema, { originalId: "o1", partNumbers: [] })).toBe(false);
    expect(ok(adminMultipartPartsSchema, { originalId: "o1", partNumbers: [0] })).toBe(false);
    expect(ok(adminMultipartPartsSchema, { originalId: "o1", partNumbers: [10_001] })).toBe(false);
    expect(ok(adminMultipartPartsSchema, { originalId: "o1", partNumbers: Array.from({ length: 51 }, (_, i) => i + 1) })).toBe(false);
  });

  it("complete: at least one part with an etag", () => {
    expect(ok(adminMultipartCompleteSchema, { originalId: "o1", parts: [{ partNumber: 1, etag: '"e"' }] })).toBe(true);
    expect(ok(adminMultipartCompleteSchema, { originalId: "o1", parts: [] })).toBe(false);
    expect(ok(adminMultipartCompleteSchema, { originalId: "o1", parts: [{ partNumber: 1, etag: "" }] })).toBe(false);
  });
});
