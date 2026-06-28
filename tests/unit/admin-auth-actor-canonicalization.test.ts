import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getActorFromAuth, requireAdminSession } from "@/lib/api/auth";
import { createAppContextFromRequest } from "@/lib/api/app-context-factory";
import { requireAdminForApi } from "@/lib/auth-utils";

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    patronGrant: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/modules/patron", () => ({
  getPatronStatus: vi.fn(async () => ({
    ok: true,
    data: { activeGrants: [] },
  })),
}));

function mockAuth(userId: string | null, role?: string) {
  vi.mocked(auth).mockResolvedValue({
    userId,
    sessionClaims: role ? { metadata: { role } } : { metadata: {} },
  } as unknown as Awaited<ReturnType<typeof auth>>);
}

describe("canonical server actor resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ADMIN_CLERK_USER_IDS = "";
  });

  it("allows DB ADMIN without an admin claim for page/API actor resolution", async () => {
    mockAuth("admin_1");
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "admin_1",
      role: "ADMIN",
      isDeleted: false,
    } as never);

    await expect(requireAdminSession()).resolves.toMatchObject({
      userId: "admin_1",
      role: "admin",
    });
    await expect(
      requireAdminForApi("TEST_DB_ADMIN_NO_CLAIM"),
    ).resolves.toMatchObject({ adminUserId: "admin_1", response: null });
  });

  it("allows DB ADMIN even when Clerk claim says USER", async () => {
    mockAuth("admin_1", "USER");
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "admin_1",
      role: "ADMIN",
      isDeleted: false,
    } as never);

    await expect(getActorFromAuth({ allowGuest: false })).resolves.toEqual({
      type: "admin",
      userId: "admin_1",
    });
  });

  it("does not grant admin bypass from admin claim when DB role is USER", async () => {
    mockAuth("user_1", "admin");
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user_1",
      role: "USER",
      isDeleted: false,
    } as never);

    await expect(getActorFromAuth({ allowGuest: false })).resolves.toEqual({
      type: "user",
      userId: "user_1",
    });
    const { response } = await requireAdminForApi("TEST_CLAIM_ADMIN_DB_USER");
    expect(response?.status).toBe(403);
  });

  it("denies claim admin with no local User", async () => {
    mockAuth("ghost_1", "admin");
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null as never);

    await expect(getActorFromAuth({ allowGuest: false })).rejects.toMatchObject(
      { code: "FORBIDDEN" },
    );
  });

  it("denies claim admin with deleted local User", async () => {
    mockAuth("deleted_1", "admin");
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "deleted_1",
      role: "USER",
      isDeleted: true,
    } as never);

    await expect(getActorFromAuth({ allowGuest: false })).rejects.toMatchObject(
      { code: "FORBIDDEN" },
    );
  });

  it("denies DB ADMIN when local User is deleted", async () => {
    mockAuth("deleted_admin", "USER");
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "deleted_admin",
      role: "ADMIN",
      isDeleted: true,
    } as never);

    const { response } = await requireAdminForApi("TEST_DELETED_DB_ADMIN");
    expect(response?.status).toBe(403);
  });

  it("allows configured admin ID only when the local User is active", async () => {
    process.env.ADMIN_CLERK_USER_IDS = "configured_1";
    mockAuth("configured_1");
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "configured_1",
      role: "USER",
      isDeleted: false,
    } as never);

    await expect(getActorFromAuth({ allowGuest: false })).resolves.toEqual({
      type: "admin",
      userId: "configured_1",
    });
  });

  it("denies configured admin ID when the local User is deleted", async () => {
    process.env.ADMIN_CLERK_USER_IDS = "configured_1";
    mockAuth("configured_1");
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "configured_1",
      role: "USER",
      isDeleted: true,
    } as never);

    await expect(getActorFromAuth({ allowGuest: false })).rejects.toMatchObject(
      { code: "FORBIDDEN" },
    );
  });

  it("returns guest only when explicitly allowed and denies guest in privileged contexts", async () => {
    mockAuth(null);

    await expect(getActorFromAuth()).resolves.toEqual({ type: "guest" });
    await expect(getActorFromAuth({ allowGuest: false })).rejects.toMatchObject(
      { code: "UNAUTHORIZED" },
    );
  });

  it("requires admin for app context factory used by admin routes", async () => {
    mockAuth("user_1", "admin");
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user_1",
      role: "USER",
      isDeleted: false,
    } as never);

    await expect(createAppContextFromRequest("req_1")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("does not persist ADMIN_CLERK_USER_IDS into local role during authorization", async () => {
    process.env.ADMIN_CLERK_USER_IDS = "configured_1";
    mockAuth("configured_1");
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "configured_1",
      role: "USER",
      isDeleted: false,
    } as never);

    const { adminUserId, response } = await requireAdminForApi(
      "TEST_CONFIGURED_ADMIN_ACTIVE",
    );

    expect(adminUserId).toBe("configured_1");
    expect(response).toBeNull();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

describe("requireAdminForApi canonical privileged boundary regressions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ADMIN_CLERK_USER_IDS = "";
  });

  it("returns 403 for configured admin ID with no local User", async () => {
    process.env.ADMIN_CLERK_USER_IDS = "configured_missing";
    mockAuth("configured_missing");
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null as never);

    const { response } = await requireAdminForApi("TEST_CONFIGURED_MISSING");

    expect(response?.status).toBe(403);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("returns 403 for stale admin claim with no local User", async () => {
    mockAuth("claim_only_admin", "admin");
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null as never);

    const { response } = await requireAdminForApi("TEST_CLAIM_ADMIN_MISSING");

    expect(response?.status).toBe(403);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
