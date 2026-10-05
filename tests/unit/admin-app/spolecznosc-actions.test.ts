import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  comments: { approveHeldComment: vi.fn(), deleteAdminComment: vi.fn(), hideAdminComment: vi.fn(), resolveCommentReport: vi.fn(), restoreAdminComment: vi.fn() },
  users: { changeUserRoleFromPanel: vi.fn(), deleteUserFromPanel: vi.fn() },
  guard: { requireAdmin: vi.fn(async () => ({ userId: "adm1", email: "owner@panel.example", name: "O", sessionCreatedAt: "", stepUpSecondsLeft: 0 })), hasFreshStepUp: vi.fn(async () => true) },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (to: string) => { throw new Error(`REDIRECT ${to}`); } }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/modules/comments", () => m.comments);
vi.mock("@/lib/modules/users", () => m.users);
vi.mock("@admin/lib/auth/guard", () => m.guard);

import { changeRoleAction, deleteUserAction, moderateCommentAction, resolveReportAction } from "@admin/app/(panel)/spolecznosc/actions";

const ok = { ok: true as const, data: undefined };

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.ADMIN_DEV_FIXTURES;
  m.guard.hasFreshStepUp.mockResolvedValue(true);
  for (const f of Object.values(m.comments)) f.mockResolvedValue(ok);
});

describe("role and deletion", () => {
  it("need a fresh step-up and call nothing without it", async () => {
    m.guard.hasFreshStepUp.mockResolvedValue(false);
    expect(await changeRoleAction({ userId: "u1", role: "ADMIN" })).toMatchObject({ code: "STEP_UP_REQUIRED" });
    expect(await deleteUserAction({ userId: "u1", confirmEmail: "a@b.c" })).toMatchObject({ code: "STEP_UP_REQUIRED" });
    expect(m.users.changeUserRoleFromPanel).not.toHaveBeenCalled();
    expect(m.users.deleteUserFromPanel).not.toHaveBeenCalled();
  });

  it("pass the panel e-mail so the use case can refuse acting on yourself", async () => {
    m.users.changeUserRoleFromPanel.mockResolvedValue({ ok: true, data: { changed: true, role: "ADMIN" } });
    expect(await changeRoleAction({ userId: "u1", role: "ADMIN" })).toMatchObject({ ok: true });
    expect(m.users.changeUserRoleFromPanel).toHaveBeenCalledWith(expect.anything(), { userId: "u1", role: "ADMIN", panelEmail: "owner@panel.example" });
  });

  it("maps use-case refusals to Polish messages", async () => {
    m.users.changeUserRoleFromPanel.mockResolvedValue({ ok: false, error: { code: "LAST_ADMIN", message: "x" } });
    expect(await changeRoleAction({ userId: "u1", role: "USER" })).toMatchObject({ ok: false, message: expect.stringContaining("ostatni administrator") });
  });

  it("deletion redirects to the list on success", async () => {
    m.users.deleteUserFromPanel.mockResolvedValue({ ok: true, data: { deleted: true } });
    await expect(deleteUserAction({ userId: "u1", confirmEmail: " a@b.c " })).rejects.toThrow("REDIRECT /spolecznosc?usunieto=1");
    expect(m.users.deleteUserFromPanel).toHaveBeenCalledWith(expect.anything(), { userId: "u1", confirmEmail: "a@b.c", panelEmail: "owner@panel.example" });
  });

  it("rejects an unknown role", async () => {
    expect((await changeRoleAction({ userId: "u1", role: "PATRON" as never })).ok).toBe(false);
  });
});

describe("moderation", () => {
  it("runs the matching use case", async () => {
    await moderateCommentAction({ commentId: "c1", op: "hide" });
    await moderateCommentAction({ commentId: "c1", op: "delete" });
    expect(m.comments.hideAdminComment).toHaveBeenCalledWith("c1", expect.anything());
    expect(m.comments.deleteAdminComment).toHaveBeenCalledWith({ commentId: "c1" }, expect.anything());
  });

  it("upholding a report hides the comment, then closes the report as ACTION_TAKEN; already hidden is fine", async () => {
    m.comments.hideAdminComment.mockResolvedValue({ ok: false, error: { type: "CONFLICT", message: "już ukryty" } });
    m.comments.resolveCommentReport.mockResolvedValue({ ok: true, data: { id: "r1", status: "ACTION_TAKEN" } });
    expect(await resolveReportAction({ reportId: "r1", decision: "act", commentId: "c1" })).toMatchObject({ ok: true });
    expect(m.comments.resolveCommentReport).toHaveBeenCalledWith("r1", "ACTION_TAKEN", expect.anything());
  });

  it("dismissing never touches the comment", async () => {
    m.comments.resolveCommentReport.mockResolvedValue({ ok: true, data: { id: "r1", status: "DISMISSED" } });
    await resolveReportAction({ reportId: "r1", decision: "dismiss", commentId: "c1" });
    expect(m.comments.hideAdminComment).not.toHaveBeenCalled();
    expect(m.comments.resolveCommentReport).toHaveBeenCalledWith("r1", "DISMISSED", expect.anything());
  });

  it("sample data refuses writes", async () => {
    process.env.ADMIN_DEV_FIXTURES = "1";
    expect(await moderateCommentAction({ commentId: "c1", op: "hide" })).toMatchObject({ code: "SAMPLE_DATA" });
  });
});
