import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const prisma = vi.hoisted(() => ({ user: { findUnique: vi.fn(), update: vi.fn() } }));

vi.mock("@/lib/auth/server", () => ({ auth: authMock }));
vi.mock("@/lib/prisma", () => ({ prisma }));

import { getActorFromAuth, requireAdminActor } from "@/lib/api/auth";

function signedInAs(userId: string | null) {
  authMock.mockResolvedValue({ userId, sessionId: userId ? "s1" : null, user: null, sessionClaims: null });
}

beforeEach(() => {
  vi.clearAllMocks();
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

describe("requireAdminActor (role flag only, no e-mail bootstrap)", () => {
  it("accepts a user whose role is ADMIN", async () => {
    signedInAs("a1");
    prisma.user.findUnique.mockResolvedValue({ id: "a1", role: "ADMIN", isDeleted: false });
    expect(await requireAdminActor()).toEqual({ type: "admin", userId: "a1" });
  });

  it("never promotes anybody by e-mail, even when the removed ADMIN_EMAILS variable is still set", async () => {
    vi.stubEnv("ADMIN_EMAILS", "owner@example.com");
    signedInAs("o1");
    prisma.user.findUnique.mockResolvedValue({ id: "o1", role: "USER", isDeleted: false, email: "owner@example.com", emailVerified: true });
    await expect(requireAdminActor()).rejects.toMatchObject({ statusCode: 403 });
    expect(await getActorFromAuth()).toEqual({ type: "user", userId: "o1" });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("ignores an admin claim in the session: only the database role counts", async () => {
    authMock.mockResolvedValue({ userId: "u1", sessionId: "s1", user: null, sessionClaims: { metadata: { role: "ADMIN" } } });
    prisma.user.findUnique.mockResolvedValue({ id: "u1", role: "USER", isDeleted: false });
    await expect(requireAdminActor()).rejects.toMatchObject({ statusCode: 403 });
    prisma.user.findUnique.mockResolvedValue({ id: "u1", role: "ADMIN", isDeleted: true });
    await expect(requireAdminActor()).rejects.toMatchObject({ statusCode: 403 });
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(requireAdminActor()).rejects.toMatchObject({ statusCode: 403 });
  });

  it("does not make plain users admins", async () => {
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
