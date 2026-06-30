import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { requireAdminForApi } from "@/lib/auth-utils";
import { GET as getAdminStats } from "@/app/api/admin/stats/route";

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    video: {
      count: vi.fn(),
    },
    payment: {
      groupBy: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/modules/users/application/sync-user.use-case", () => ({
  getOrCreateUser: vi.fn(),
}));

import { getOrCreateUser } from "@/lib/modules/users/application/sync-user.use-case";

describe("admin API access protection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ADMIN_EMAIL = "admin@example.com";
    process.env.ADMIN_CLERK_USER_IDS = "";
    vi.mocked(getOrCreateUser).mockResolvedValue({
      id: "user_1",
    } as never);
  });

  it("returns 401 for guests before any admin database reads", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as Awaited<
      ReturnType<typeof auth>
    >);

    const { adminUserId, response } =
      await requireAdminForApi("TEST_ADMIN_GUEST");

    expect(adminUserId).toBeNull();
    expect(response?.status).toBe(401);
    expect(await response?.json()).toEqual({ error: "Unauthorized" });
    expect(getOrCreateUser).not.toHaveBeenCalled();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("returns 403 for authenticated non-admin users", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "user_1" } as Awaited<
      ReturnType<typeof auth>
    >);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      role: "USER",
      isDeleted: false,
      email: "viewer@example.com",
    } as never);

    const { adminUserId, response } = await requireAdminForApi(
      "TEST_ADMIN_FORBIDDEN",
    );

    expect(adminUserId).toBeNull();
    expect(response?.status).toBe(403);
    expect(await response?.json()).toEqual({ error: "Forbidden" });
  });

  it("allows existing ADMIN users", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "admin_1" } as Awaited<
      ReturnType<typeof auth>
    >);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      role: "ADMIN",
      isDeleted: false,
      email: "owner@example.com",
    } as never);

    const { adminUserId, response } =
      await requireAdminForApi("TEST_ADMIN_ALLOWED");

    expect(adminUserId).toBe("admin_1");
    expect(response).toBeNull();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("does not grant admin access from ADMIN_EMAIL alone", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "admin_1" } as Awaited<
      ReturnType<typeof auth>
    >);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      role: "USER",
      isDeleted: false,
      email: "admin@example.com",
    } as never);

    const { adminUserId, response } = await requireAdminForApi(
      "TEST_ADMIN_EMAIL_NO_BOOTSTRAP",
    );

    expect(adminUserId).toBeNull();
    expect(response?.status).toBe(403);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("allows active users from ADMIN_CLERK_USER_IDS without mutating role", async () => {
    process.env.ADMIN_CLERK_USER_IDS = "admin_1,admin_2";
    vi.mocked(auth).mockResolvedValue({ userId: "admin_1" } as Awaited<
      ReturnType<typeof auth>
    >);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      role: "USER",
      isDeleted: false,
      email: "viewer@example.com",
    } as never);
    vi.mocked(prisma.user.update).mockResolvedValue({} as never);

    const { adminUserId, response } = await requireAdminForApi(
      "TEST_ADMIN_ID_ALLOWLIST",
    );

    expect(adminUserId).toBe("admin_1");
    expect(response).toBeNull();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("protects representative admin API routes before route-specific work starts", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "user_1" } as Awaited<
      ReturnType<typeof auth>
    >);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      role: "USER",
      isDeleted: false,
      email: "viewer@example.com",
    } as never);

    const response = await getAdminStats(
      new NextRequest("http://localhost/api/admin/stats"),
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Forbidden" });
    expect(prisma.user.count).not.toHaveBeenCalled();
    expect(prisma.video.count).not.toHaveBeenCalled();
    expect(prisma.payment.groupBy).not.toHaveBeenCalled();
  });
});
