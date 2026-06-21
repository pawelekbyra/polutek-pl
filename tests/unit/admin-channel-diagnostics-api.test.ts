import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { GET } from "@/app/api/admin/channel/route";

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    creator: {
      findUnique: vi.fn(),
    },
    patronGrant: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/feature-flags", () => ({
  flags: {
    mainCreatorSlug: "main-channel",
  },
}));

vi.mock("@/lib/modules/patron", () => ({
  getPatronStatus: vi.fn(async () => ({
    ok: true,
    data: { activeGrants: [] },
  })),
}));

describe("admin channel diagnostics API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ADMIN_CLERK_USER_IDS = "";
    vi.mocked(auth).mockResolvedValue({ userId: "admin-1" } as Awaited<
      ReturnType<typeof auth>
    >);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "admin-1",
      role: "ADMIN",
      isDeleted: false,
    } as never);
  });

  it("returns typed channel diagnostics with the admin settings DTO", async () => {
    vi.mocked(prisma.creator.findUnique).mockResolvedValueOnce({
      id: "channel-1",
      slug: "main-channel",
      isApproved: true,
      isPrimary: true,
    } as never);
    vi.mocked(prisma.creator.findUnique).mockResolvedValueOnce({
      id: "channel-1",
      slug: "main-channel",
      name: "Main",
      bio: null,
      bannerUrl: null,
      subscribersCount: 7,
      displaySubscribersCount: null,
      user: { id: "admin-1", email: "admin@example.com", name: null, imageUrl: null },
    } as never);

    const response = await GET(
      new NextRequest("http://localhost/api/admin/channel", {
        headers: { "x-request-id": "req_123" },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      creator: expect.objectContaining({ id: "channel-1", slug: "main-channel" }),
      diagnostics: {
        configuredSlug: "main-channel",
        mainChannelLookup: "FOUND",
        mainChannelId: "channel-1",
        isApproved: true,
        isPrimary: true,
        settingsRecord: "FOUND",
      },
    });
  });

  it("returns a stable safe response for missing main channel", async () => {
    vi.mocked(prisma.creator.findUnique).mockResolvedValueOnce(null as never);

    const response = await GET(new NextRequest("http://localhost/api/admin/channel"));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "CHANNEL_DIAGNOSTICS_ERROR",
      code: "MAIN_CHANNEL_NOT_FOUND",
      message: "Main channel configuration is missing.",
    });
  });

  it("does not expose sensitive database internals in JSON responses", async () => {
    vi.mocked(prisma.creator.findUnique).mockRejectedValueOnce({
      code: "P1001",
      message: "Cannot reach postgres://user:password@db.example.internal:5432/app?sslmode=require",
    } as never);

    const response = await GET(new NextRequest("http://localhost/api/admin/channel"));
    const bodyText = await response.text();

    expect(response.status).toBe(500);
    expect(bodyText).toContain("CHANNEL_DATABASE_ERROR");
    expect(bodyText).not.toContain("postgres://");
    expect(bodyText).not.toContain("password");
    expect(bodyText).not.toContain("db.example.internal");
  });
});
