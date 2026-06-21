import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { GET } from "@/app/api/admin/emails/status/route";
import { requireAdminForApi } from "@/lib/auth-utils";

vi.mock("@/lib/auth-utils", () => ({
  requireAdminForApi: vi.fn(),
}));

describe("admin email status API", () => {
  const originalAudienceId = process.env.RESEND_AUDIENCE_ID;

  function restoreAudienceId() {
    if (originalAudienceId === undefined) {
      delete process.env.RESEND_AUDIENCE_ID;
      return;
    }

    process.env.RESEND_AUDIENCE_ID = originalAudienceId;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    restoreAudienceId();
    vi.mocked(requireAdminForApi).mockResolvedValue({
      adminUserId: "admin-1",
      response: null,
    });
  });

  afterEach(() => {
    restoreAudienceId();
  });

  it("returns safe email diagnostics for admins without leaking raw env values", async () => {
    process.env.RESEND_AUDIENCE_ID = "aud_secret_value";

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
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
    expect(JSON.stringify(data)).not.toContain("aud_secret_value");
  });

  it("reports missing audience configuration as a boolean status", async () => {
    delete process.env.RESEND_AUDIENCE_ID;

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.audience.configured).toBe(false);
    expect(JSON.stringify(data)).not.toContain("RESEND_AUDIENCE_ID");
  });

  it("returns requireAdminForApi response for non-admins", async () => {
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
