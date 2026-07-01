import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { GET } from "@/app/api/admin/channel/route";
import { requireAdminForApi } from "@/lib/auth-utils";
import { getAdminChannelSettings } from "@/lib/modules/channel";

vi.mock("@/lib/auth-utils", () => ({
  requireAdminForApi: vi.fn(),
}));

vi.mock("@/lib/modules/channel", async () => {
  const actual = await vi.importActual<typeof import("@/lib/modules/channel")>(
    "@/lib/modules/channel",
  );
  return {
    ...actual,
    getAdminChannelSettings: vi.fn(),
  };
});

vi.mock("@/lib/logger", () => ({
  createScopedLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

function getRequest() {
  return new NextRequest("http://localhost/api/admin/channel", {
    headers: { "x-request-id": "req-1" },
  });
}

describe("admin channel diagnostics API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAdminForApi).mockResolvedValue({
      adminUserId: "admin-1",
      response: null,
    });
  });

  it("returns creator with safe diagnostics for admins", async () => {
    vi.mocked(getAdminChannelSettings).mockResolvedValue({
      creator: {
        id: "creator-1",
        slug: "polutek",
        name: "Polutek",
        bio: null,
        bannerUrl: null,
        defaultThumbnailUrl: null,
        subscribersCount: 3,
        displaySubscribersCount: null,
        user: {
          id: "user-1",
          email: "admin@example.com",
          name: "Admin",
          imageUrl: null,
        },
      },
      diagnostics: {
        mainChannelConfigured: true,
        mainChannelSlug: "polutek",
        creatorLoaded: true,
        userLoaded: true,
      },
    });

    const response = await GET(getRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.creator.name).toBe("Polutek");
    expect(data.diagnostics).toEqual({
      mainChannelConfigured: true,
      mainChannelSlug: "polutek",
      creatorLoaded: true,
      userLoaded: true,
    });
  });

  it("returns requireAdminForApi response for non-admins", async () => {
    vi.mocked(requireAdminForApi).mockResolvedValue({
      adminUserId: null,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    });

    const response = await GET(getRequest());
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data).toEqual({ error: "Forbidden" });
    expect(getAdminChannelSettings).not.toHaveBeenCalled();
  });

  it("returns stable safe CHANNEL_DIAGNOSTICS_ERROR JSON without raw provider details", async () => {
    vi.mocked(getAdminChannelSettings).mockRejectedValue(
      new Error("postgres://user:password@db.internal/schema drift"),
    );

    const response = await GET(getRequest());
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("CHANNEL_DIAGNOSTICS_ERROR");
    expect(data.message).toContain("Channel diagnostics could not be loaded");
    expect(data.diagnostics).toEqual({
      ok: false,
      code: "CHANNEL_DIAGNOSTICS_ERROR",
    });
    expect(JSON.stringify(data)).not.toContain("postgres://");
    expect(JSON.stringify(data)).not.toContain("schema drift");
  });
});
