/** @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import React from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh, replace: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a> }));
const toast = vi.fn();
vi.mock("@admin/components/shell/toasts", () => ({ useToast: () => ({ toast }) }));
const actions = vi.hoisted(() => ({ decideQueueItemAction: vi.fn(), undoModerationAction: vi.fn(), moderateCommentsAction: vi.fn(), replyAsCreatorAction: vi.fn(), setHeartAction: vi.fn() }));
const userActions = vi.hoisted(() => ({ muteUserAction: vi.fn(), changeRoleAction: vi.fn(), deleteUserAction: vi.fn(), revokeSessionsAction: vi.fn(), setSupporterAction: vi.fn(), unmuteUserAction: vi.fn(), viewAsPersonAction: vi.fn() }));
vi.mock("@admin/app/(panel)/spolecznosc/actions", () => actions);
vi.mock("@admin/app/(panel)/spolecznosc/user-actions", () => userActions);

import { CommentList } from "@admin/components/community/comment-list";
import { ModerationQueue } from "@admin/components/community/moderation-queue";
import { ProfileActions } from "@admin/components/community/profile-actions";
import type { PanelComment } from "@/lib/modules/comments";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

const comment = (over: Partial<PanelComment> = {}): PanelComment => ({
  id: "c1", text: "Kup tanie zegarki", status: "VISIBLE", deletedReason: null, createdAt: "2026-10-05T08:00:00.000Z", parentId: null,
  video: { id: "v1", title: "Cześć", slug: "czesc" }, author: { id: "u1", name: "spamer", isDeleted: false, isAdmin: false, commentsCount: 2, mutedUntil: null },
  likesCount: 0, repliesCount: 0, reportsCount: 1, isHearted: false, creatorReplied: false, isQuestion: false,
  pendingReports: [{ id: "r1", reason: "SPAM", note: null, createdAt: "2026-10-05T08:30:00.000Z", reporter: "Ola" }], ...over,
});
const RESULT = { changed: [{ commentId: "c1", from: "VISIBLE", to: "HIDDEN" }], unchanged: [], resolvedReports: [{ id: "r1", commentId: "c1" }], batchId: "b" };
const press = (key: string) => fireEvent.keyDown(document, { key });

describe("ModerationQueue keyboard", () => {
  it("h hides the active comment (one request) and offers Cofnij that restores statuses and reports", async () => {
    actions.decideQueueItemAction.mockResolvedValue({ ok: true, message: "Komentarz ukryty.", data: RESULT });
    actions.undoModerationAction.mockResolvedValue({ ok: true });
    render(<ModerationQueue items={[comment(), comment({ id: "c2", text: "Drugi" })]} />);
    press("h");
    await waitFor(() => expect(actions.decideQueueItemAction).toHaveBeenCalledWith({ commentId: "c1", decision: "hide" }));
    expect(actions.decideQueueItemAction).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByText("Kup tanie zegarki")).not.toBeInTheDocument());
    const undo = toast.mock.calls.find((c) => c[3]?.label === "Cofnij")![3];
    undo.run();
    await waitFor(() => expect(actions.undoModerationAction).toHaveBeenCalledWith({ changes: [{ commentId: "c1", from: "VISIBLE", to: "HIDDEN" }], reports: [{ id: "r1", commentId: "c1" }] }));
  });

  it("j/k move the active item; z keeps (dismisses reports); keys are ignored in inputs and open dialogs", async () => {
    actions.decideQueueItemAction.mockResolvedValue({ ok: true, message: "ok", data: { ...RESULT, changed: [] } });
    render(<ModerationQueue items={[comment(), comment({ id: "c2", text: "Drugi" })]} />);
    press("j");
    press("z");
    await waitFor(() => expect(actions.decideQueueItemAction).toHaveBeenCalledWith({ commentId: "c2", decision: "keep" }));
    actions.decideQueueItemAction.mockClear();
    const input = document.createElement("input");
    document.body.append(input);
    fireEvent.keyDown(input, { key: "h" });
    expect(actions.decideQueueItemAction).not.toHaveBeenCalled();
    input.remove();
  });

  it("w opens the mute dialog with a required reason and sends the author id", async () => {
    userActions.muteUserAction.mockResolvedValue({ ok: true, message: "Komentowanie wyciszone na 7 dni." });
    render(<ModerationQueue items={[comment()]} />);
    press("w");
    fireEvent.change(await screen.findByLabelText("Powód"), { target: { value: "spam" } });
    fireEvent.submit(screen.getByRole("button", { name: "Wycisz komentowanie" }).closest("form")!);
    await waitFor(() => expect(userActions.muteUserAction).toHaveBeenCalledWith({ userId: "u1", days: 7, reason: "spam" }));
  });

  it("does not offer mute for admins and shows an empty state", () => {
    render(<ModerationQueue items={[comment({ author: { id: "a", name: "Właściciel", isDeleted: false, isAdmin: true, commentsCount: 50, mutedUntil: null } })]} />);
    expect(screen.queryByRole("button", { name: /Wycisz autora/ })).not.toBeInTheDocument();
    cleanup();
    render(<ModerationQueue items={[]} />);
    expect(screen.getByText("Kolejka pusta")).toBeInTheDocument();
  });
});

describe("CommentList bulk actions", () => {
  it("sends every selected id in ONE request and caps the selection at 50", async () => {
    actions.moderateCommentsAction.mockResolvedValue({ ok: true, message: "2 komentarzy: ukryte.", data: RESULT });
    render(<CommentList returnPath="/spolecznosc?tab=komentarze" items={[comment(), comment({ id: "c2", text: "B" })]} />);
    for (const box of screen.getAllByRole("checkbox", { name: /Zaznacz komentarz/ })) fireEvent.click(box);
    fireEvent.click(screen.getByRole("button", { name: /^Ukryj$/ }));
    await waitFor(() => expect(actions.moderateCommentsAction).toHaveBeenCalledWith({ ids: ["c1", "c2"], op: "hide", videoSlug: undefined }));
    expect(actions.moderateCommentsAction).toHaveBeenCalledTimes(1);
    cleanup();
    const many = Array.from({ length: 60 }, (_, i) => comment({ id: `c${i}`, text: `t${i}` }));
    render(<CommentList returnPath="/x" items={many} />);
    fireEvent.click(screen.getByLabelText(/Zaznacz widoczne/));
    expect(screen.getByText("Zaznaczono: 50")).toBeInTheDocument();
  });

  it("delete shows the consequence dialog and goes to step-up when the server asks", async () => {
    actions.moderateCommentsAction.mockResolvedValue({ ok: false, code: "STEP_UP_REQUIRED", message: "Potwierdź" });
    render(<CommentList returnPath="/spolecznosc?tab=komentarze&page=2" items={[comment()]} />);
    fireEvent.click(screen.getByRole("button", { name: /Usuń komentarz: spamer/ }));
    expect(screen.getByText("Skutek")).toBeInTheDocument();
    fireEvent.submit(screen.getByRole("button", { name: "Usuń" }).closest("form")!);
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/potwierdz?next=${encodeURIComponent("/spolecznosc?tab=komentarze&page=2")}`));
  });

  it("reply dialog sends text and heart choice", async () => {
    actions.replyAsCreatorAction.mockResolvedValue({ ok: true, message: "Odpowiedź opublikowana." });
    render(<CommentList returnPath="/x" items={[comment()]} />);
    fireEvent.click(screen.getByRole("button", { name: /Odpowiedz jako twórca: spamer/ }));
    fireEvent.change(await screen.findByLabelText("Twoja odpowiedź"), { target: { value: "Dzięki!" } });
    fireEvent.submit(screen.getByRole("button", { name: "Opublikuj odpowiedź" }).closest("form")!);
    await waitFor(() => expect(actions.replyAsCreatorAction).toHaveBeenCalledWith({ commentId: "c1", text: "Dzięki!", heart: true, videoSlug: undefined }));
  });
});

describe("ProfileActions", () => {
  const base = { userId: "u1", name: "Ola", email: "ola@example.com", role: "USER" as const, isDeleted: false, isSupporter: false, muted: false, sessions: 2, impact: { comments: 7, payments: 3, activeGrants: 0, sessions: 2 } };

  it("deletion lists the consequences, needs the typed e-mail and goes to step-up when required", async () => {
    userActions.deleteUserAction.mockResolvedValue({ ok: false, code: "STEP_UP_REQUIRED", message: "Potwierdź" });
    render(<ProfileActions {...base} />);
    fireEvent.click(screen.getByRole("button", { name: "Usuń…" }));
    expect(screen.getByText(/7 komentarzy zostaje/)).toBeInTheDocument();
    expect(screen.getByText(/3 wpłat zostaje/)).toBeInTheDocument();
    const go = screen.getByRole("button", { name: "Usuń konto" });
    fireEvent.submit(go.closest("form")!);
    expect(userActions.deleteUserAction).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Wpisz adres e-mail konta"), { target: { value: "ola@example.com" } });
    fireEvent.submit(go.closest("form")!);
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/potwierdz?next=${encodeURIComponent("/spolecznosc/u/u1")}`));
    expect(userActions.deleteUserAction).toHaveBeenCalledWith({ userId: "u1", confirmEmail: "ola@example.com" });
  });

  it("supporter dialog requires the reason and sends the chosen action", async () => {
    userActions.setSupporterAction.mockResolvedValue({ ok: true, message: "Znacznik wspierającego nadany." });
    render(<ProfileActions {...base} />);
    fireEvent.click(screen.getByRole("button", { name: "Znacznik wspierającego…" }));
    expect(screen.getByLabelText("Powód")).toBeRequired();
    fireEvent.change(screen.getByLabelText("Powód"), { target: { value: "przelew" } });
    fireEvent.submit(screen.getByRole("button", { name: "Nadaj znacznik" }).closest("form")!);
    await waitFor(() => expect(userActions.setSupporterAction).toHaveBeenCalledWith({ userId: "u1", action: "grant", reason: "przelew" }));
  });

  it("view-as shows the read-only explanation", async () => {
    userActions.viewAsPersonAction.mockResolvedValue({ ok: true, data: { signIn: { ok: true, why: "Konto aktywne" }, commenting: { ok: false, why: "Wyciszone" }, films: [{ videoId: "v", slug: "s", title: "Cześć", tier: "LOGGED_IN", canWatch: true, why: "zalogowana" }] } });
    render(<ProfileActions {...base} />);
    fireEvent.click(screen.getByRole("button", { name: "Podgląd jako ta osoba" }));
    expect(await screen.findByText("Cześć")).toBeInTheDocument();
    expect(screen.getByText(/ADMIN_VIEW_AS/)).toBeInTheDocument();
  });

  it("admins cannot be deleted or muted from here; deleted accounts show no actions", () => {
    render(<ProfileActions {...base} role="ADMIN" />);
    expect(screen.getByRole("button", { name: "Usuń…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Wycisz komentowanie/ })).toBeDisabled();
    cleanup();
    render(<ProfileActions {...base} isDeleted />);
    expect(screen.getByText(/brak akcji/)).toBeInTheDocument();
  });
});
