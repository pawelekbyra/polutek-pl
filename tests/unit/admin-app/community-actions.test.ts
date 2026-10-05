import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  comments: { moderateCommentsBulk: vi.fn(), undoCommentModeration: vi.fn(), createCreatorReply: vi.fn(), setAdminCommentHeart: vi.fn(), BULK_MODERATION_LIMIT: 50 },
  users: { changeUserRoleFromPanel: vi.fn(), deleteUserFromPanel: vi.fn(), muteUserCommenting: vi.fn(), unmuteUserCommenting: vi.fn(), revokeUserSessions: vi.fn(), MUTE_DAYS: [1, 7, 30, 365] },
  patron: { adminSetSupporter: vi.fn() },
  community: { viewAsPerson: vi.fn() },
  guard: { requireAdmin: vi.fn(async () => ({ userId: "adm1", email: "owner@panel.example", name: "O", sessionCreatedAt: "", stepUpSecondsLeft: 0 })), hasFreshStepUp: vi.fn(async () => true) },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (to: string) => { throw Object.assign(new Error(`REDIRECT ${to}`), { digest: "NEXT_REDIRECT" }); } }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "cf-ray": "ray1" }) }));
vi.mock("@/lib/modules/comments", () => m.comments);
vi.mock("@/lib/modules/users", () => m.users);
vi.mock("@/lib/modules/patron", () => m.patron);
vi.mock("@/lib/modules/admin-community", () => m.community);
vi.mock("@admin/lib/auth/guard", () => m.guard);

import { decideQueueItemAction, moderateCommentsAction, replyAsCreatorAction, setHeartAction, undoModerationAction } from "@admin/app/(panel)/spolecznosc/actions";
import { changeRoleAction, deleteUserAction, muteUserAction, revokeSessionsAction, setSupporterAction, viewAsPersonAction } from "@admin/app/(panel)/spolecznosc/user-actions";
import { resetRateLimits } from "@admin/lib/actions/rate-limit";

const ok = <T,>(data: T) => ({ ok: true as const, data });
const BULK = { changed: [{ commentId: "c1", from: "VISIBLE", to: "HIDDEN" }], unchanged: [], resolvedReports: [], batchId: "b" };

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimits();
  delete process.env.ADMIN_DEV_FIXTURES;
  m.guard.hasFreshStepUp.mockResolvedValue(true);
  m.comments.moderateCommentsBulk.mockResolvedValue(ok(BULK));
});

describe("moderateCommentsAction", () => {
  it("sends the whole selection in ONE use-case call; hide settles reports as upheld", async () => {
    const res = await moderateCommentsAction({ ids: ["c1", "c2", "c3"], op: "hide" });
    expect(res).toMatchObject({ ok: true, message: "Komentarz ukryty." });
    expect(m.comments.moderateCommentsBulk).toHaveBeenCalledTimes(1);
    expect(m.comments.moderateCommentsBulk).toHaveBeenCalledWith(expect.objectContaining({ actor: { type: "admin", userId: "adm1" }, requestId: "ray1" }), { ids: ["c1", "c2", "c3"], action: "hide", reports: "action" });
  });
  it("restore and approve leave reports alone", async () => {
    await moderateCommentsAction({ ids: ["c1"], op: "restore" });
    expect(m.comments.moderateCommentsBulk).toHaveBeenCalledWith(expect.anything(), { ids: ["c1"], action: "restore", reports: "none" });
  });
  it("delete needs a fresh step-up and reaches the use case only with it", async () => {
    m.guard.hasFreshStepUp.mockResolvedValue(false);
    expect(await moderateCommentsAction({ ids: ["c1"], op: "delete" })).toMatchObject({ ok: false, code: "STEP_UP_REQUIRED" });
    expect(m.comments.moderateCommentsBulk).not.toHaveBeenCalled();
    m.guard.hasFreshStepUp.mockResolvedValue(true);
    expect(await moderateCommentsAction({ ids: ["c1"], op: "delete" })).toMatchObject({ ok: true });
    expect(m.comments.moderateCommentsBulk).toHaveBeenCalledWith(expect.anything(), { ids: ["c1"], action: "delete", reports: "action" });
  });
  it("hide does not need step-up (reversible)", async () => {
    m.guard.hasFreshStepUp.mockResolvedValue(false);
    expect(await moderateCommentsAction({ ids: ["c1"], op: "hide" })).toMatchObject({ ok: true });
  });
  it("rejects unknown fields, empty and oversized selections before any use case (zod strict)", async () => {
    expect(await moderateCommentsAction({ ids: ["c1"], op: "hide", extra: 1 } as never)).toMatchObject({ ok: false, code: "BAD_REQUEST" });
    expect(await moderateCommentsAction({ ids: [], op: "hide" })).toMatchObject({ ok: false });
    expect(await moderateCommentsAction({ ids: Array.from({ length: 51 }, (_, i) => `c${i}`), op: "hide" })).toMatchObject({ ok: false });
    expect(await moderateCommentsAction({ ids: ["c1"], op: "nuke" as never })).toMatchObject({ ok: false });
    expect(m.comments.moderateCommentsBulk).not.toHaveBeenCalled();
  });
  it("maps a use-case conflict to its Polish message and says when nothing changed", async () => {
    m.comments.moderateCommentsBulk.mockResolvedValueOnce({ ok: false, error: { type: "CONFLICT", message: "1 z zaznaczonych komentarzy jest w stanie, który nie pozwala na tę czynność." } });
    expect(await moderateCommentsAction({ ids: ["c1"], op: "hide" })).toMatchObject({ ok: false, code: "CONFLICT", message: expect.stringContaining("nie pozwala") });
    m.comments.moderateCommentsBulk.mockResolvedValueOnce(ok({ ...BULK, changed: [], unchanged: ["c1"] }));
    expect(await moderateCommentsAction({ ids: ["c1"], op: "hide" })).toMatchObject({ ok: true, message: expect.stringContaining("Bez zmian") });
  });
  it("is rate limited per admin", async () => {
    for (let i = 0; i < 120; i++) await moderateCommentsAction({ ids: ["c1"], op: "hide" });
    expect(await moderateCommentsAction({ ids: ["c1"], op: "hide" })).toMatchObject({ ok: false, code: "RATE_LIMITED" });
  });
  it("sample data refuses writes", async () => {
    process.env.ADMIN_DEV_FIXTURES = "1";
    expect(await moderateCommentsAction({ ids: ["c1"], op: "hide" })).toMatchObject({ code: "SAMPLE_DATA" });
  });
  it("turns an unexpected exception into a generic message without details", async () => {
    m.comments.moderateCommentsBulk.mockRejectedValueOnce(new Error("connection refused 10.0.0.5"));
    const res = await moderateCommentsAction({ ids: ["c1"], op: "hide" });
    expect(res).toMatchObject({ ok: false });
    expect(JSON.stringify(res)).not.toContain("10.0.0.5");
  });
});

describe("queue decisions and undo", () => {
  it("hide and hold uphold the reports, keep dismisses them", async () => {
    await decideQueueItemAction({ commentId: "c1", decision: "hide" });
    await decideQueueItemAction({ commentId: "c1", decision: "hold" });
    await decideQueueItemAction({ commentId: "c1", decision: "keep" });
    expect(m.comments.moderateCommentsBulk.mock.calls.map((c) => [c[1].action, c[1].reports])).toEqual([["hide", "action"], ["hold", "action"], ["keep", "dismiss"]]);
  });
  it("undo passes the snapshot through and refuses a DELETED status", async () => {
    m.comments.undoCommentModeration.mockResolvedValue(ok({ restored: 1, reopened: 0 }));
    expect(await undoModerationAction({ changes: [{ commentId: "c1", from: "VISIBLE", to: "HIDDEN" }], reports: [] })).toMatchObject({ ok: true });
    expect(await undoModerationAction({ changes: [{ commentId: "c1", from: "VISIBLE", to: "DELETED" as never }], reports: [] })).toMatchObject({ ok: false, code: "BAD_REQUEST" });
  });
  it("reply and heart go through their use cases", async () => {
    m.comments.createCreatorReply.mockResolvedValue(ok({ id: "n", parentId: "c1", duplicate: false }));
    m.comments.setAdminCommentHeart.mockResolvedValue(ok({ isHearted: true, changed: true }));
    expect(await replyAsCreatorAction({ commentId: "c1", text: "Dzięki", heart: true })).toMatchObject({ ok: true, message: "Odpowiedź opublikowana." });
    expect(m.comments.createCreatorReply).toHaveBeenCalledWith(expect.anything(), { commentId: "c1", text: "Dzięki", heart: true });
    expect(await setHeartAction({ commentId: "c1", hearted: true })).toMatchObject({ ok: true });
    expect(await replyAsCreatorAction({ commentId: "c1", text: "x", heart: true, evil: 1 } as never)).toMatchObject({ ok: false });
  });
});

describe("people actions", () => {
  it("role change and deletion need a fresh step-up and call nothing without it", async () => {
    m.guard.hasFreshStepUp.mockResolvedValue(false);
    expect(await changeRoleAction({ userId: "u1", role: "ADMIN" })).toMatchObject({ code: "STEP_UP_REQUIRED" });
    expect(await deleteUserAction({ userId: "u1", confirmEmail: "a@b.c" })).toMatchObject({ code: "STEP_UP_REQUIRED" });
    expect(m.users.changeUserRoleFromPanel).not.toHaveBeenCalled();
    expect(m.users.deleteUserFromPanel).not.toHaveBeenCalled();
  });
  it("passes the panel e-mail so the use case can refuse acting on yourself; maps refusals to Polish", async () => {
    m.users.changeUserRoleFromPanel.mockResolvedValue(ok({ changed: true, role: "ADMIN" }));
    expect(await changeRoleAction({ userId: "u1", role: "ADMIN" })).toMatchObject({ ok: true });
    expect(m.users.changeUserRoleFromPanel).toHaveBeenCalledWith(expect.anything(), { userId: "u1", role: "ADMIN", panelEmail: "owner@panel.example" });
    m.users.changeUserRoleFromPanel.mockResolvedValue({ ok: false, error: { code: "LAST_ADMIN", message: "x" } });
    expect(await changeRoleAction({ userId: "u1", role: "USER" })).toMatchObject({ ok: false, message: expect.stringContaining("ostatni administrator") });
    expect((await changeRoleAction({ userId: "u1", role: "PATRON" as never })).ok).toBe(false);
  });
  it("deletion redirects to the list on success and shows the mismatch message otherwise", async () => {
    m.users.deleteUserFromPanel.mockResolvedValue(ok({ deleted: true }));
    await expect(deleteUserAction({ userId: "u1", confirmEmail: " a@b.c " })).rejects.toThrow("REDIRECT /spolecznosc?tab=uzytkownicy&usunieto=1");
    expect(m.users.deleteUserFromPanel).toHaveBeenCalledWith(expect.anything(), { userId: "u1", confirmEmail: "a@b.c", panelEmail: "owner@panel.example" });
    m.users.deleteUserFromPanel.mockResolvedValue({ ok: false, error: { code: "CONFIRM_EMAIL_MISMATCH", message: "x" } });
    expect(await deleteUserAction({ userId: "u1", confirmEmail: "zly@b.c" })).toMatchObject({ ok: false, message: expect.stringContaining("e-mail") });
  });
  it("deletion is limited to 5 attempts per 10 minutes", async () => {
    m.users.deleteUserFromPanel.mockResolvedValue({ ok: false, error: { code: "CONFIRM_EMAIL_MISMATCH", message: "x" } });
    for (let i = 0; i < 5; i++) await deleteUserAction({ userId: "u1", confirmEmail: "zly@b.c" });
    expect(await deleteUserAction({ userId: "u1", confirmEmail: "zly@b.c" })).toMatchObject({ code: "RATE_LIMITED" });
  });
  it("supporter marker needs a reason, mute only the allowed lengths", async () => {
    m.patron.adminSetSupporter.mockResolvedValue(ok({ changed: true, isSupporter: true }));
    expect(await setSupporterAction({ userId: "u1", action: "grant", reason: "ab" })).toMatchObject({ ok: false, code: "BAD_REQUEST" });
    expect(await setSupporterAction({ userId: "u1", action: "grant", reason: "przelew" })).toMatchObject({ ok: true, message: "Znacznik wspierającego nadany." });
    m.patron.adminSetSupporter.mockResolvedValue(ok({ changed: false, isSupporter: true }));
    expect(await setSupporterAction({ userId: "u1", action: "grant", reason: "przelew" })).toMatchObject({ message: "Znacznik już był nadany." });
    expect(await muteUserAction({ userId: "u1", days: 3, reason: "spam" })).toMatchObject({ ok: false });
    m.users.muteUserCommenting.mockResolvedValue(ok({ mutedUntil: new Date() }));
    expect(await muteUserAction({ userId: "u1", days: 7, reason: "spam" })).toMatchObject({ ok: true });
  });
  it("sign out everywhere and view-as run through their use cases", async () => {
    m.users.revokeUserSessions.mockResolvedValue(ok({ revoked: 2 }));
    expect(await revokeSessionsAction({ userId: "u1" })).toMatchObject({ ok: true, message: expect.stringContaining("2") });
    m.community.viewAsPerson.mockResolvedValue(ok({ signIn: { ok: true, why: "" }, commenting: { ok: true, why: "" }, films: [] }));
    expect(await viewAsPersonAction({ userId: "u1" })).toMatchObject({ ok: true });
    expect(m.community.viewAsPerson).toHaveBeenCalledWith(expect.anything(), "u1");
  });
});
