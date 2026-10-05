import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  sec: { revokeAdminSession: vi.fn(), revokeOtherAdminSessions: vi.fn() },
  guard: { requireAdmin: vi.fn(async () => ({ userId: "adm1", email: "o@x", name: "O", sessionId: "cur", sessionCreatedAt: "", stepUpSecondsLeft: 0 })), hasFreshStepUp: vi.fn(async () => true) },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "cf-ray": "r1" }) }));
vi.mock("@admin/lib/auth/security", () => m.sec);
vi.mock("@admin/lib/auth/guard", () => m.guard);

import { revokeOtherSessionsAction, revokeSessionAction } from "@admin/app/(panel)/bezpieczenstwo/actions";
import { resetRateLimits } from "@admin/lib/actions/rate-limit";

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimits();
  delete process.env.ADMIN_DEV_FIXTURES;
});

describe("session actions", () => {
  it("pass the current session id so it can never be revoked", async () => {
    m.sec.revokeAdminSession.mockResolvedValue({ ok: false, reason: "current_session" });
    expect(await revokeSessionAction({ sessionId: "cur" })).toMatchObject({ ok: false, message: expect.stringContaining("bieżąca sesja") });
    expect(m.sec.revokeAdminSession).toHaveBeenCalledWith(expect.objectContaining({ sessionId: "cur", currentSessionId: "cur", actorUserId: "adm1" }));
  });
  it("revokes another session, validates input, and revokes the others", async () => {
    m.sec.revokeAdminSession.mockResolvedValue({ ok: true, revoked: 1 });
    expect(await revokeSessionAction({ sessionId: "other" })).toMatchObject({ ok: true });
    expect(await revokeSessionAction({ sessionId: "" })).toMatchObject({ ok: false });
    expect(await revokeSessionAction({ sessionId: "x", extra: 1 } as never)).toMatchObject({ ok: false });
    m.sec.revokeOtherAdminSessions.mockResolvedValue(2);
    expect(await revokeOtherSessionsAction()).toMatchObject({ ok: true, data: { count: 2 } });
  });
});
