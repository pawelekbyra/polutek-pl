import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { GET } from "@/app/api/admin/emails/status/route";
import { requireAdminForApi } from "@/lib/auth-utils";

vi.mock("@/lib/auth-utils", () => ({
  requireAdminForApi: vi.fn(),
}));

const ORIGINAL_ENV = process.env;

describe("admin email status API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...ORIGINAL_ENV,
      RESEND_AUDIENCE_ID: "audience-ci",
    };
    vi.mocked(requireAdminForApi).mockResolvedValue({
      adminUserId: "admin-1",
      response: null,
    });
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it("returns safe configured email diagnostics for admins", async () => {
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(requireAdminForApi).toHaveBeenCalledWith("GET_ADMIN_EMAILS_STATUS");
    expect(data).toEqual({
      provider: "Resend",
      audience: {
        configured: true,
      },
      webhooks: {
        status: "UNVERIFIED",
        label: "Niezweryfikowane",
        message:
          "Brak automatycznego health checku webhooków w panelu. Zweryfikuj konfigurację po stronie operatora/provider dashboard.",
      },
    });
    expect(JSON.stringify(data)).not.toContain("audience-ci");
  });

  it("reports audience as not configured without leaking env values", async () => {
    process.env = {
      ...ORIGINAL_ENV,
      RESEND_AUDIENCE_ID: "",
    };

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.audience.configured).toBe(false);
    expect(JSON.stringify(data)).not.toContain("RESEND_AUDIENCE_ID");
  });

  it("returns the requireAdminForApi response for non-admin requests", async () => {
    vi.mocked(requireAdminForApi).mockResolvedValue({
      adminUserId: null,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data).toEqual({ error: "Forbidden" });
  });
});
