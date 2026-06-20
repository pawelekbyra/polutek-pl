import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { GET, POST } from "@/app/api/admin/health/cloudflare/route";
import { requireAdminForApi } from "@/lib/auth-utils";

vi.mock("@/lib/auth-utils", () => ({
  requireAdminForApi: vi.fn(),
}));

const ORIGINAL_ENV = process.env;
const TOKEN = "cf_test_token_secret_value";

function adminAllowed() {
  vi.mocked(requireAdminForApi).mockResolvedValue({ adminUserId: "admin-1", response: null });
}

function setCloudflareEnv(overrides: Partial<NodeJS.ProcessEnv> = {}) {
  process.env = {
    ...ORIGINAL_ENV,
    CLOUDFLARE_ACCOUNT_ID: "account-123",
    CLOUDFLARE_API_TOKEN: TOKEN,
    CLOUDFLARE_WEBHOOK_SECRET: "webhook-secret",
    ...overrides,
  };
}

function getRequest(path: string) {
  return new NextRequest(`http://localhost${path}`);
}

function postRequest(body: unknown) {
  return new NextRequest("http://localhost/api/admin/health/cloudflare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("admin Cloudflare health route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCloudflareEnv();
    vi.stubGlobal("fetch", vi.fn());
    adminAllowed();
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    vi.unstubAllGlobals();
  });

  it("preserves the existing plain GET health response", async () => {
    const response = await GET(getRequest("/api/admin/health/cloudflare"));
    const data = await response.json();

    expect(data.configured).toBe(true);
    expect(data.runtime).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns MISSING_ENV for auth probe when required env is absent", async () => {
    setCloudflareEnv({ CLOUDFLARE_API_TOKEN: "" });

    const response = await GET(getRequest("/api/admin/health/cloudflare?probe=auth"));
    const data = await response.json();

    expect(data.ok).toBe(false);
    expect(data.diagnosis).toBe("MISSING_ENV");
    expect(data.missing).toContain("CLOUDFLARE_API_TOKEN");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns TOKEN_HAS_BEARER_PREFIX when token includes Bearer prefix", async () => {
    setCloudflareEnv({ CLOUDFLARE_API_TOKEN: `Bearer ${TOKEN}` });

    const response = await GET(getRequest("/api/admin/health/cloudflare?probe=auth"));
    const data = await response.json();

    expect(data.ok).toBe(false);
    expect(data.diagnosis).toBe("TOKEN_HAS_BEARER_PREFIX");
    expect(JSON.stringify(data)).not.toContain(TOKEN);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("maps Cloudflare 9106 on auth probe to AUTH_FAILED_OR_ACCOUNT_MISMATCH", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({ success: false, errors: [{ code: 9106, message: "Authentication failed" }] }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      ),
    );

    const response = await GET(getRequest("/api/admin/health/cloudflare?probe=auth"));
    const data = await response.json();

    expect(data.ok).toBe(false);
    expect(data.status).toBe(400);
    expect(data.diagnosis).toBe("AUTH_FAILED_OR_ACCOUNT_MISMATCH");
    expect(data.description).toContain("CLOUDFLARE_API_TOKEN");
    expect(data.cloudflareErrors).toEqual([{ code: 9106, message: "Authentication failed" }]);
    expect(JSON.stringify(data)).not.toContain(TOKEN);
  });

  it("does not return uploadURL for successful direct-upload probe", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          result: {
            uid: "abcdef1234567890",
            uploadURL: "https://upload.cloudflarestream.com/sensitive-direct-upload-url",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const response = await POST(postRequest({ probe: "direct-upload" }));
    const data = await response.json();

    expect(data).toMatchObject({
      ok: true,
      diagnosis: "DIRECT_UPLOAD_OK",
      uidPresent: true,
      uidPrefix: "abcdef12",
      uploadUrlPresent: true,
    });
    expect(data.uploadURL).toBeUndefined();
    expect(JSON.stringify(data)).not.toContain("upload.cloudflarestream.com");
    expect(JSON.stringify(data)).not.toContain(TOKEN);
  });

  it("returns the requireAdminForApi response for non-admin requests", async () => {
    vi.mocked(requireAdminForApi).mockResolvedValue({
      adminUserId: null,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    });

    const response = await GET(getRequest("/api/admin/health/cloudflare?probe=auth"));
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data).toEqual({ error: "Forbidden" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not include the API token value in Cloudflare error responses", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({ success: false, errors: [{ code: 10000, message: "Authentication error" }] }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      ),
    );

    const response = await POST(postRequest({ probe: "direct-upload" }));
    const data = await response.json();

    expect(data.diagnosis).toBe("AUTH_FAILED_OR_PERMISSION_MISSING");
    expect(JSON.stringify(data)).not.toContain(TOKEN);
  });
});
