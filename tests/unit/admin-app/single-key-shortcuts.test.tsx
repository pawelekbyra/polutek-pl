/** @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import React from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn(), replace: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a> }));
vi.mock("@admin/components/shell/toasts", () => ({ useToast: () => ({ toast: vi.fn() }) }));
const actions = vi.hoisted(() => ({ decideQueueItemAction: vi.fn(), undoModerationAction: vi.fn() }));
vi.mock("@admin/app/(panel)/spolecznosc/actions", () => actions);
vi.mock("@admin/app/(panel)/spolecznosc/user-actions", () => ({ muteUserAction: vi.fn() }));

import { ModerationQueue } from "@admin/components/community/moderation-queue";
import { ShortcutsDialog } from "@admin/components/shell/shortcuts-dialog";
import { SINGLE_KEY_SHORTCUTS_KEY, readSingleKeyShortcuts, writeSingleKeyShortcuts } from "@admin/lib/single-key-shortcuts";
import type { PanelComment } from "@/lib/modules/comments";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
afterEach(() => { cleanup(); vi.clearAllMocks(); localStorage.clear(); });

const comment: PanelComment = {
  id: "c1", text: "Kup tanie zegarki", status: "VISIBLE", deletedReason: null, createdAt: "2026-10-05T08:00:00.000Z", parentId: null,
  video: { id: "v1", title: "Cześć", slug: "czesc" }, author: { id: "u1", name: "spamer", isDeleted: false, isAdmin: false, commentsCount: 2, mutedUntil: null },
  likesCount: 0, repliesCount: 0, reportsCount: 1, isHearted: false, creatorReplied: false, isQuestion: false,
  pendingReports: [{ id: "r1", reason: "SPAM", note: null, createdAt: "2026-10-05T08:30:00.000Z", reporter: "Ola" }],
};
const RESULT = { changed: [{ commentId: "c1", from: "VISIBLE", to: "HIDDEN" }], unchanged: [], resolvedReports: [], batchId: "b" };

describe("A06: single-character shortcuts can be switched off and cannot act from elsewhere on the page", () => {
  it("defaults to on, and the stored choice is read back", () => {
    expect(readSingleKeyShortcuts()).toBe(true);
    writeSingleKeyShortcuts(false);
    expect(localStorage.getItem(SINGLE_KEY_SHORTCUTS_KEY)).toBe("off");
    expect(readSingleKeyShortcuts()).toBe(false);
    writeSingleKeyShortcuts(true);
    expect(readSingleKeyShortcuts()).toBe(true);
  });

  it("with the shortcuts off, h does not hide the comment", async () => {
    writeSingleKeyShortcuts(false);
    render(<ModerationQueue items={[comment]} />);
    fireEvent.keyDown(document, { key: "h" });
    await new Promise((r) => setTimeout(r, 20));
    expect(actions.decideQueueItemAction).not.toHaveBeenCalled();
  });

  it("h from a control outside the queue does nothing; from inside the queue it decides", async () => {
    actions.decideQueueItemAction.mockResolvedValue({ ok: true, message: "ok", data: RESULT });
    render(<ModerationQueue items={[comment]} />);
    const outside = document.createElement("button");
    document.body.append(outside);
    outside.focus();
    fireEvent.keyDown(outside, { key: "h" });
    await new Promise((r) => setTimeout(r, 20));
    expect(actions.decideQueueItemAction).not.toHaveBeenCalled();
    outside.remove();

    fireEvent.keyDown(screen.getByRole("article"), { key: "h" });
    await waitFor(() => expect(actions.decideQueueItemAction).toHaveBeenCalledWith({ commentId: "c1", decision: "hide" }));
  });

  it("the shortcuts window has a checkbox that stores the choice", () => {
    render(<ShortcutsDialog open onClose={() => undefined} />);
    const box = screen.getByRole("checkbox", { name: /Skróty jednoznakowe włączone/ });
    expect(box).toBeChecked();
    fireEvent.click(box);
    expect(box).not.toBeChecked();
    expect(readSingleKeyShortcuts()).toBe(false);
    fireEvent.click(box);
    expect(readSingleKeyShortcuts()).toBe(true);
  });
});
