/** @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import React from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh, replace: vi.fn() }) }));
const actions = vi.hoisted(() => ({
  deleteFilmAction: vi.fn(),
  filmStatusAction: vi.fn(),
  saveLayoutAction: vi.fn(),
}));
vi.mock("@admin/app/(panel)/tresci/actions", () => actions);

import { ConfirmDialog } from "@admin/components/confirm-dialog";
import { DangerZone } from "@admin/components/content/danger-zone";
import { LayoutEditor } from "@admin/components/content/layout-editor";

beforeAll(() => {
  // jsdom has no <dialog> modal API.
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ConfirmDialog with typed confirmation", () => {
  it("keeps the button disabled until the exact text is typed and passes it on", () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog open options={{ title: "Usunąć?", confirm: "Usuń", danger: true, typed: { label: "Wpisz adres filmu", expect: "czesc" } }} onConfirm={onConfirm} onClose={() => undefined} />);
    const go = screen.getByRole("button", { name: "Usuń" });
    expect(go).toHaveAttribute("aria-disabled", "true");
    fireEvent.submit(go.closest("form")!);
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Wpisz adres filmu"), { target: { value: " czesc " } });
    expect(go).toHaveAttribute("aria-disabled", "false");
    fireEvent.submit(go.closest("form")!);
    expect(onConfirm).toHaveBeenCalledWith("czesc");
  });
});

describe("DangerZone", () => {
  it("sends the typed address to the server and goes to step-up when it is required", async () => {
    actions.deleteFilmAction.mockResolvedValue({ ok: false, code: "STEP_UP_REQUIRED", message: "Najpierw potwierdź tożsamość" });
    render(<DangerZone id="v1" slug="czesc" title="Cześć" archived={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Usuń…" }));
    fireEvent.change(screen.getByLabelText("Wpisz adres filmu"), { target: { value: "czesc" } });
    fireEvent.submit(screen.getByRole("button", { name: "Usuń film" }).closest("form")!);
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/potwierdz?next=${encodeURIComponent("/tresci/czesc/edycja#usun")}`));
    expect(actions.deleteFilmAction).toHaveBeenCalledWith({ id: "v1", typedSlug: "czesc", returnTo: "/tresci/czesc/edycja#usun" });
  });
});

describe("LayoutEditor", () => {
  const rows = [
    { id: "a", title: "A", tier: "PUBLIC", showInSidebar: true, isMainFeatured: true, upcoming: false },
    { id: "b", title: "B", tier: "LOGGED_IN", showInSidebar: true, isMainFeatured: false, upcoming: true },
  ];

  it("moves rows, hides one and saves the whole layout at once", async () => {
    actions.saveLayoutAction.mockResolvedValue({ ok: true, message: "Zapisano układ (2 filmów)." });
    render(<LayoutEditor initial={rows} />);
    expect(screen.getByRole("button", { name: "Zapisz układ" })).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(screen.getByRole("button", { name: "W dół: A" }));
    fireEvent.click(screen.getByLabelText("Pokazuj „A” na liście filmów"));
    fireEvent.click(screen.getByRole("button", { name: "Zapisz układ" }));
    await waitFor(() => expect(actions.saveLayoutAction).toHaveBeenCalledWith({ order: ["b", "a"], hidden: ["a"], heroId: "a" }));
  });

  it("moves with Alt+arrow on a focused row and allows Hero only for public films", () => {
    render(<LayoutEditor initial={rows} />);
    fireEvent.keyDown(screen.getByRole("row", { name: "2. B" }), { key: "ArrowUp", altKey: true });
    expect(screen.getAllByRole("row")[1]).toHaveAccessibleName("1. B");
    expect(screen.getByRole("radio", { name: /Hero.*B/ })).toBeDisabled();
  });
});
