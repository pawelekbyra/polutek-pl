import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getActorFromAuth, requireAdminSession } from "@/lib/api/auth";
import { requireAdminForApi } from "@/lib/auth-utils";
import { resolveNavbarAdminUiState } from "@/lib/navbar-admin-ui";

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

describe("Post-merge Admin Auth Canonicalization Verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ADMIN_CLERK_USER_IDS = "";
  });

  it("VERIFY: DB admin without claim has access", async () => {
    mockAuth("db_admin_1"); // No role claim
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "db_admin_1",
      role: "ADMIN",
      isDeleted: false,
    } as any);

    const actor = await getActorFromAuth({ allowGuest: false });
    expect(actor).toEqual({ type: "admin", userId: "db_admin_1" });

    const session = await requireAdminSession();
    expect(session.role).toBe("admin");
  });

  it("VERIFY: Old admin claim at DB USER does not give access", async () => {
    mockAuth("revoked_admin_1", "admin"); // Has claim
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "revoked_admin_1",
      role: "USER",
      isDeleted: false,
    } as any);

    const actor = await getActorFromAuth({ allowGuest: false });
    expect(actor.type).toBe("user"); // Downgraded to user despite claim

    const { response } = await requireAdminForApi("TEST_REVOKED");
    expect(response?.status).toBe(403);
  });

  it("VERIFY: Missing local User gives 403", async () => {
    mockAuth("missing_user", "admin");
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    await expect(getActorFromAuth({ allowGuest: false })).rejects.toThrow();
    const { response } = await requireAdminForApi("TEST_MISSING");
    expect(response?.status).toBe(403);
  });

  it("VERIFY: isDeleted=true gives 403", async () => {
    mockAuth("deleted_user", "admin");
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "deleted_user",
      isDeleted: true,
      role: "ADMIN",
    } as any);

    await expect(getActorFromAuth({ allowGuest: false })).rejects.toThrow();
    const { response } = await requireAdminForApi("TEST_DELETED");
    expect(response?.status).toBe(403);
  });

  it("VERIFY: Configured admin works exclusively with active local User", async () => {
    process.env.ADMIN_CLERK_USER_IDS = "configured_admin";

    // Active case
    mockAuth("configured_admin");
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "configured_admin",
      isDeleted: false,
      role: "USER",
    } as any);

    const actor = await getActorFromAuth({ allowGuest: false });
    expect(actor.type).toBe("admin");

    // Deleted case
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "configured_admin",
      isDeleted: true,
      role: "USER",
    } as any);
    await expect(getActorFromAuth({ allowGuest: false })).rejects.toThrow();

    // Missing case
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    await expect(getActorFromAuth({ allowGuest: false })).rejects.toThrow();
  });

  it("VERIFY: Navbar shows admin for DB admin without metadata", () => {
    const serverIsAdmin = true;
    const metadataRole = undefined;
    expect(resolveNavbarAdminUiState(serverIsAdmin, metadataRole)).toBe(true);
  });

  it("VERIFY: Navbar logic - metadata does not give server access (UI only hint if server says false)", () => {
    // This is about resolveNavbarAdminUiState returning true if EITHER is true for UI responsiveness,
    // but the server MUST still block it.
    const serverIsAdmin = false;
    const metadataRole = "ADMIN";
    expect(resolveNavbarAdminUiState(serverIsAdmin, metadataRole)).toBe(true);
    // ^ This is expected UI behavior (showing the link), but server-side verification (getActorFromAuth) must block.
  });
});
