import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { GET, POST } from "@/app/api/admin/health/mux/route";
import { requireAdminForApi } from "@/lib/auth-utils";

vi.mock("@/lib/auth-utils", () => ({
  requireAdminForApi: vi.fn(),
}));

const ORIGINAL_ENV = process.env;
const TOKEN_ID = "mux_test_token_id";
const TOKEN_SECRET = "mux_test_token_secret_value";

const VALID_PEM = Buffer.from(
  "-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEAfake==\n-----END RSA PRIVATE KEY-----",
).toString("base64");

function adminAllowed() {
  vi.mocked(requireAdminForApi).mockResolvedValue({ adminUserId: "admin-1", response: null });
}

function setMuxEnv(overrides: Partial<NodeJS.ProcessEnv> = {}) {
  process.env = {
    ...ORIGINAL_ENV,
    MUX_TOKEN_ID: TOKEN_ID,
    MUX_TOKEN_SECRET: TOKEN_SECRET,
    MUX_WEBHOOK_SECRET: "mux-webhook-secret",
    MUX_SIGNING_KEY_ID: "signing-key-id",
    MUX_SIGNING_PRIVATE_KEY: VALID_PEM,
    ...overrides,
  };
}

function getRequest(path: string) {
  return new NextRequest(`http://localhost${path}`);
}

function postRequest(body: unknown) {
  return new NextRequest("http://localhost/api/admin/health/mux", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("admin Mux health route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setMuxEnv();
    vi.stubGlobal("fetch", vi.fn());
    adminAllowed();
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    vi.unstubAllGlobals();
  });

  it("returns configured=true and runtime diagnostics for plain GET", async () => {
    const response = await GET(getRequest("/api/admin/health/mux"));
    const data = await response.json();

    expect(data.configured).toBe(true);
    expect(data.runtime).toBeTruthy();
    expect(data.signing.configured).toBe(true);
    expect(data.signing.keyFormatValid).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns configured=false with missing env names when envs are absent", async () => {
    setMuxEnv({ MUX_TOKEN_ID: "", MUX_TOKEN_SECRET: "" });

    const response = await GET(getRequest("/api/admin/health/mux"));
    const data = await response.json();

    expect(data.configured).toBe(false);
    expect(data.missing).toContain("MUX_TOKEN_ID");
    expect(data.missing).toContain("MUX_TOKEN_SECRET");
    expect(JSON.stringify(data)).not.toContain(TOKEN_SECRET);
  });

  it("returns MISSING_ENV for auth probe when required env is absent", async () => {
    setMuxEnv({ MUX_TOKEN_SECRET: "" });

    const response = await GET(getRequest("/api/admin/health/mux?probe=auth"));
    const data = await response.json();

    expect(data.ok).toBe(false);
    expect(data.diagnosis).toBe("MISSING_ENV");
    expect(data.missing).toContain("MUX_TOKEN_SECRET");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns INVALID_SIGNING_KEY_FORMAT when signing key is not valid base64 PEM", async () => {
    setMuxEnv({ MUX_SIGNING_PRIVATE_KEY: "not-a-valid-pem-key" });

    const response = await GET(getRequest("/api/admin/health/mux?probe=auth"));
    const data = await response.json();

    expect(data.ok).toBe(false);
    expect(data.diagnosis).toBe("INVALID_SIGNING_KEY_FORMAT");
    expect(data.description).toContain("MUX_SIGNING_PRIVATE_KEY");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns MUX_READ_OK for successful auth probe", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const response = await GET(getRequest("/api/admin/health/mux?probe=auth"));
    const data = await response.json();

    expect(data.ok).toBe(true);
    expect(data.diagnosis).toBe("MUX_READ_OK");
    expect(JSON.stringify(data)).not.toContain(TOKEN_SECRET);
  });

  it("returns AUTH_FAILED on 401 from Mux auth probe", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const response = await GET(getRequest("/api/admin/health/mux?probe=auth"));
    const data = await response.json();

    expect(data.ok).toBe(false);
    expect(data.status).toBe(401);
    expect(data.diagnosis).toBe("AUTH_FAILED");
    expect(JSON.stringify(data)).not.toContain(TOKEN_SECRET);
  });

  it("returns PERMISSION_DENIED on 403 from Mux auth probe", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const response = await GET(getRequest("/api/admin/health/mux?probe=auth"));
    const data = await response.json();

    expect(data.ok).toBe(false);
    expect(data.diagnosis).toBe("PERMISSION_DENIED");
  });

  it("returns NETWORK_OR_RUNTIME_ERROR when fetch throws on auth probe", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("Network error"));

    const response = await GET(getRequest("/api/admin/health/mux?probe=auth"));
    const data = await response.json();

    expect(data.ok).toBe(false);
    expect(data.diagnosis).toBe("NETWORK_OR_RUNTIME_ERROR");
  });

  it("returns DIRECT_UPLOAD_OK for successful direct-upload probe", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          data: { id: "abcdef1234567890", url: "https://storage.googleapis.com/sensitive-url" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const response = await POST(postRequest({ probe: "direct-upload" }));
    const data = await response.json();

    expect(data).toMatchObject({
      ok: true,
      diagnosis: "DIRECT_UPLOAD_OK",
      uploadIdPresent: true,
      uploadIdPrefix: "abcdef12",
    });
    expect(JSON.stringify(data)).not.toContain("storage.googleapis.com");
    expect(JSON.stringify(data)).not.toContain(TOKEN_SECRET);
  });

  it("returns MISSING_ENV for direct-upload probe when env is absent", async () => {
    setMuxEnv({ MUX_TOKEN_ID: "" });

    const response = await POST(postRequest({ probe: "direct-upload" }));
    const data = await response.json();

    expect(data.ok).toBe(false);
    expect(data.diagnosis).toBe("MISSING_ENV");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects unknown probe in POST body", async () => {
    const response = await POST(postRequest({ probe: "unknown" }));

    expect(response.status).toBe(400);
  });

  it("returns the requireAdminForApi response for non-admin GET requests", async () => {
    vi.mocked(requireAdminForApi).mockResolvedValue({
      adminUserId: null,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    });

    const response = await GET(getRequest("/api/admin/health/mux?probe=auth"));
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data).toEqual({ error: "Forbidden" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not include token secret in any error response", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const response = await POST(postRequest({ probe: "direct-upload" }));
    const data = await response.json();

    expect(JSON.stringify(data)).not.toContain(TOKEN_SECRET);
    expect(JSON.stringify(data)).not.toContain(TOKEN_ID);
  });
});
