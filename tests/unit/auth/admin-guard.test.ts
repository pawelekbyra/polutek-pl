import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const prisma = vi.hoisted(() => ({ user: { findUnique: vi.fn(), update: vi.fn() } }));
const audit = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/server", () => ({ auth: authMock }));
vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/auth/audit", () => ({ recordAuthAudit: audit }));

import { getActorFromAuth, requireAdminActor } from "@/lib/api/auth";

function signedInAs(userId: string | null) {
  authMock.mockResolvedValue({ userId, sessionId: userId ? "s1" : null, user: null, sessionClaims: null });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("ADMIN_EMAILS", "owner@example.com");
});
afterEach(() => vi.unstubAllEnvs());

describe("getActorFromAuth", () => {
  it("is a guest without a session", async () => {
    signedInAs(null);
    expect(await getActorFromAuth()).toEqual({ type: "guest" });
    await expect(getActorFromAuth({ allowGuest: false })).rejects.toMatchObject({ statusCode: 401 });
  });

  it("rejects a soft-deleted or unknown user", async () => {
    signedInAs("u1");
    prisma.user.findUnique.mockResolvedValueOnce({ id: "u1", role: "USER", isDeleted: true, email: "x@y.pl", emailVerified: true });
    await expect(getActorFromAuth()).rejects.toMatchObject({ statusCode: 403 });
    prisma.user.findUnique.mockResolvedValueOnce(null);
    await expect(getActorFromAuth()).rejects.toMatchObject({ statusCode: 403 });
  });

  it("returns a plain user for USER role", async () => {
    signedInAs("u1");
    prisma.user.findUnique.mockResolvedValue({ id: "u1", role: "USER", isDeleted: false, email: "x@y.pl", emailVerified: true });
    expect(await getActorFromAuth()).toEqual({ type: "user", userId: "u1" });
  });

  it("returns admin for the ADMIN role without touching the bootstrap list", async () => {
    signedInAs("a1");
    prisma.user.findUnique.mockResolvedValue({ id: "a1", role: "ADMIN", isDeleted: false, email: "someone@y.pl", emailVerified: true });
    expect(await getActorFromAuth()).toEqual({ type: "admin", userId: "a1" });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

describe("admin bootstrap by ADMIN_EMAILS", () => {
  it("promotes a verified account with a listed e-mail once and audits it", async () => {
    signedInAs("o1");
    prisma.user.findUnique.mockResolvedValue({ id: "o1", role: "USER", isDeleted: false, email: "Owner@Example.com", emailVerified: true });
    expect(await requireAdminActor()).toEqual({ type: "admin", userId: "o1" });
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: "o1" }, data: { role: "ADMIN" } });
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: "AUTH_ADMIN_BOOTSTRAP", userId: "o1" }));
  });

  it("never promotes a listed e-mail that was not verified (nobody can claim it by registering first)", async () => {
    signedInAs("evil");
    prisma.user.findUnique.mockResolvedValue({ id: "evil", role: "USER", isDeleted: false, email: "owner@example.com", emailVerified: false });
    await expect(requireAdminActor()).rejects.toMatchObject({ statusCode: 403 });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("does not make unlisted users admins", async () => {
    signedInAs("u1");
    prisma.user.findUnique.mockResolvedValue({ id: "u1", role: "USER", isDeleted: false, email: "x@y.pl", emailVerified: true });
    await expect(requireAdminActor()).rejects.toMatchObject({ statusCode: 403 });
  });

  it("answers 401 for an anonymous admin request and re-reads the session without the cookie cache", async () => {
    signedInAs(null);
    await expect(requireAdminActor()).rejects.toMatchObject({ statusCode: 401 });
    expect(authMock).toHaveBeenCalledWith({ fresh: true });
  });
});
