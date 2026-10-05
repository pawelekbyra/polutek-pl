import { describe, expect, it, vi } from "vitest";
import { bucketNameProblem, diagnoseR2, hintForR2Error } from "@/lib/modules/media";

const FULL = {
  CLOUDFLARE_R2_ACCOUNT_ID: "0123456789abcdef0123456789abcdef",
  CLOUDFLARE_R2_ACCESS_KEY_ID: "AKIASECRETIDVALUE",
  CLOUDFLARE_R2_SECRET_ACCESS_KEY: "supersecretvalue",
  CLOUDFLARE_R2_BUCKET_VIDEO_ORIGINALS: "pp-originals",
  CLOUDFLARE_R2_BUCKET_THUMBNAILS_PRIVATE: "pp-thumbs",
};

describe("diagnoseR2", () => {
  it("reports missing required variables and never connects when offline mode is asked", async () => {
    const head = vi.fn();
    const r = await diagnoseR2({ env: { CLOUDFLARE_R2_ACCOUNT_ID: "abc" }, testConnection: false, head });
    expect(r.configured).toBe(false);
    expect(r.missingRequired).toContain("CLOUDFLARE_R2_SECRET_ACCESS_KEY");
    expect(head).not.toHaveBeenCalled();
  });

  it("hides secret values completely and shortens ids", async () => {
    const r = await diagnoseR2({ env: FULL, testConnection: false });
    const text = JSON.stringify(r);
    expect(text).not.toContain("supersecretvalue");
    expect(text).not.toContain("AKIASECRETIDVALUE");
    expect(r.variables.find((v) => v.name === "CLOUDFLARE_R2_SECRET_ACCESS_KEY")?.preview).toBe("ustawiona (wartość ukryta)");
    expect(r.variables.find((v) => v.name === "CLOUDFLARE_R2_ACCOUNT_ID")?.preview).toBe("012345…cdef");
    expect(r.configured).toBe(true);
  });

  it("HEADs each configured bucket and explains a 403 and a missing bucket", async () => {
    const head = vi.fn(async (bucket: string) => {
      if (bucket === "pp-thumbs") throw Object.assign(new Error("denied"), { name: "Forbidden", $metadata: { httpStatusCode: 403 } });
    });
    const r = await diagnoseR2({ env: FULL, testConnection: true, head });
    expect(head).toHaveBeenCalledTimes(2);
    expect(r.connection.checked).toBe(true);
    expect(r.connection.buckets.find((b) => b.bucket === "pp-originals")?.ok).toBe(true);
    expect(r.connection.buckets.find((b) => b.bucket === "pp-thumbs")).toMatchObject({ ok: false, hint: expect.stringContaining("odrzucił dostęp") });
    expect(hintForR2Error("NoSuchBucket", 404, "X")).toContain("nie istnieje");
  });

  it("refuses to test with a bucket given as a URL", async () => {
    expect(bucketNameProblem("https://x.r2.dev/b")).toMatch(/adres URL/);
    expect(bucketNameProblem("a/b")).toMatch(/ukośników/);
    const head = vi.fn();
    const r = await diagnoseR2({ env: { ...FULL, CLOUDFLARE_R2_BUCKET_THUMBNAILS_PRIVATE: "https://bad" }, testConnection: true, head });
    expect(r.configured).toBe(false);
    expect(head).not.toHaveBeenCalled();
  });
});
