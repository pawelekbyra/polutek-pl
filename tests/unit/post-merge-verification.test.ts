import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { getActorFromAuth, requireAdminActor } from "@/lib/api/auth";
import { resolveNavbarAdminUiState } from "@/lib/navbar-admin-ui";

vi.mock("@/lib/auth/server", () => ({
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

    await expect(requireAdminActor()).resolves.toEqual({ type: "admin", userId: "db_admin_1" });
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

    await expect(requireAdminActor()).rejects.toMatchObject({ statusCode: 403 });
  });

  it("VERIFY: Missing local User gives 403", async () => {
    mockAuth("missing_user", "admin");
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    await expect(getActorFromAuth({ allowGuest: false })).rejects.toThrow();
    await expect(requireAdminActor()).rejects.toMatchObject({ statusCode: 403 });
  });

  it("VERIFY: isDeleted=true gives 403", async () => {
    mockAuth("deleted_user", "admin");
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "deleted_user",
      isDeleted: true,
      role: "ADMIN",
    } as any);

    await expect(getActorFromAuth({ allowGuest: false })).rejects.toThrow();
    await expect(requireAdminActor()).rejects.toMatchObject({ statusCode: 403 });
  });

  it("VERIFY: an e-mail never grants admin (ADMIN_EMAILS bootstrap is gone), only the DB role does", async () => {
    process.env.ADMIN_EMAILS = "owner@example.com";
    mockAuth("owner_1");
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "owner_1",
      isDeleted: false,
      role: "USER",
      email: "owner@example.com",
      emailVerified: true,
    } as any);

    const actor = await getActorFromAuth({ allowGuest: false });
    expect(actor.type).toBe("user");
    expect(prisma.user.update).not.toHaveBeenCalled();
    delete process.env.ADMIN_EMAILS;
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
