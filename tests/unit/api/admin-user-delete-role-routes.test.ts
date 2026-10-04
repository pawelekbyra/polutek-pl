/** DELETE /api/admin/users/[userId] and PATCH /api/admin/users/[userId]/role: fresh sign-in, validation, error mapping. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AppError } from "@/lib/modules/shared/app-error";

const h = vi.hoisted(() => ({
  requireAdminForApi: vi.fn(),
  auth: vi.fn(),
  sessionFindUnique: vi.fn(),
  deleteUserAsAdmin: vi.fn(),
  changeUserRoleAsAdmin: vi.fn(),
}));

vi.mock("@/lib/auth-utils", () => ({ requireAdminForApi: h.requireAdminForApi }));
vi.mock("@/lib/auth/server", () => ({ auth: h.auth }));
vi.mock("@/lib/prisma", () => ({ prisma: { session: { findUnique: h.sessionFindUnique } } }));
vi.mock("@/lib/modules/users", () => ({
  getAdminUserDetails: vi.fn(),
  deleteUserAsAdmin: h.deleteUserAsAdmin,
  changeUserRoleAsAdmin: h.changeUserRoleAsAdmin,
}));

import { DELETE } from "@/app/api/admin/users/[userId]/route";
import { PATCH } from "@/app/api/admin/users/[userId]/role/route";

const params = (userId = "user-1") => ({ params: Promise.resolve({ userId }) });
const del = (body?: unknown) =>
  new NextRequest("http://localhost/api/admin/users/user-1", { method: "DELETE", body: body === undefined ? undefined : JSON.stringify(body) });
const patch = (body: unknown) =>
  new NextRequest("http://localhost/api/admin/users/user-1/role", { method: "PATCH", body: JSON.stringify(body) });

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000);

beforeEach(() => {
  vi.clearAllMocks();
  h.requireAdminForApi.mockResolvedValue({ adminUserId: "admin-1", response: null });
  h.auth.mockResolvedValue({ userId: "admin-1", sessionId: "s1" });
  h.sessionFindUnique.mockResolvedValue({ createdAt: minutesAgo(2) });
  h.deleteUserAsAdmin.mockResolvedValue({ ok: true, data: { deleted: true } });
  h.changeUserRoleAsAdmin.mockResolvedValue({ ok: true, data: { changed: true, role: "ADMIN" } });
});

describe("DELETE /api/admin/users/[userId]", () => {
  it("deletes with a fresh admin session and passes the typed e-mail to the use case", async () => {
    const res = await DELETE(del({ confirmEmail: "Jan@Example.com" }), params());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(h.auth).toHaveBeenCalledWith({ fresh: true });
    expect(h.deleteUserAsAdmin).toHaveBeenCalledWith(
      expect.objectContaining({ actor: { type: "admin", userId: "admin-1" } }),
      { adminUserId: "admin-1", userId: "user-1", confirmEmail: "Jan@Example.com" },
    );
  });

  it("asks for a fresh sign-in (403 REAUTH_REQUIRED) when the session is older than 10 minutes", async () => {
    h.sessionFindUnique.mockResolvedValue({ createdAt: minutesAgo(11) });
    const res = await DELETE(del({ confirmEmail: "jan@example.com" }), params());

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("REAUTH_REQUIRED");
    expect(body.message).toMatch(/zaloguj ponownie/i);
    expect(h.deleteUserAsAdmin).not.toHaveBeenCalled();
  });

  it("fails closed without a session id or when the session belongs to someone else", async () => {
    h.auth.mockResolvedValueOnce({ userId: "admin-1", sessionId: null });
    expect((await DELETE(del({ confirmEmail: "x@y.z" }), params())).status).toBe(403);
    h.auth.mockResolvedValueOnce({ userId: "other", sessionId: "s1" });
    expect((await DELETE(del({ confirmEmail: "x@y.z" }), params())).status).toBe(403);
    expect(h.deleteUserAsAdmin).not.toHaveBeenCalled();
  });

  it("returns the admin auth response untouched for a non-admin", async () => {
    h.requireAdminForApi.mockResolvedValue({ adminUserId: null, response: new Response(null, { status: 403 }) });
    expect((await DELETE(del({}), params())).status).toBe(403);
    expect(h.auth).not.toHaveBeenCalled();
  });

  it("accepts an empty body (the use case then refuses the missing confirmation) but rejects malformed JSON", async () => {
    await DELETE(del(), params());
    expect(h.deleteUserAsAdmin).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ confirmEmail: undefined }));

    const malformed = new NextRequest("http://localhost/api/admin/users/user-1", { method: "DELETE", body: "{\"confirmEmail\":" });
    expect((await DELETE(malformed, params())).status).toBe(400);
  });

  it("maps use-case refusals to their status, code and Polish message", async () => {
    h.deleteUserAsAdmin.mockResolvedValue({
      ok: false,
      error: new AppError("Nie można usunąć administratora. Najpierw odbierz mu rolę ADMIN.", 409, "TARGET_IS_ADMIN"),
    });
    const res = await DELETE(del({ confirmEmail: "a@b.c" }), params());

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "TARGET_IS_ADMIN", message: "Nie można usunąć administratora. Najpierw odbierz mu rolę ADMIN." });
  });
});

describe("PATCH /api/admin/users/[userId]/role", () => {
  it("changes the role with a fresh session", async () => {
    const res = await PATCH(patch({ role: "ADMIN" }), params());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ changed: true, role: "ADMIN" });
    expect(h.changeUserRoleAsAdmin).toHaveBeenCalledWith(expect.anything(), { adminUserId: "admin-1", userId: "user-1", role: "ADMIN" });
  });

  it("rejects an unknown role with 400", async () => {
    const res = await PATCH(patch({ role: "SUPERADMIN" }), params());
    expect(res.status).toBe(400);
    expect(h.changeUserRoleAsAdmin).not.toHaveBeenCalled();
  });

  it("asks for a fresh sign-in before changing anything", async () => {
    h.sessionFindUnique.mockResolvedValue(null);
    const res = await PATCH(patch({ role: "USER" }), params());
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("REAUTH_REQUIRED");
    expect(h.changeUserRoleAsAdmin).not.toHaveBeenCalled();
  });

  it("maps LAST_ADMIN to 409", async () => {
    h.changeUserRoleAsAdmin.mockResolvedValue({ ok: false, error: new AppError("To ostatni administrator.", 409, "LAST_ADMIN") });
    const res = await PATCH(patch({ role: "USER" }), params());
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("LAST_ADMIN");
  });
});
