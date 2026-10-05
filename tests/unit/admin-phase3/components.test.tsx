/** @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import React from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh, replace: vi.fn() }) }));
const a = vi.hoisted(() => ({ refundAction: vi.fn(), createBroadcastAction: vi.fn(), sendBroadcastTestAction: vi.fn(), saveThresholdsAction: vi.fn(), resetThresholdsAction: vi.fn() }));
vi.mock("@admin/app/(panel)/przychody/actions", () => ({ refundAction: a.refundAction, syncDisputeAction: vi.fn() }));
vi.mock("@admin/app/(panel)/komunikacja/actions", () => ({ createBroadcastAction: a.createBroadcastAction, sendBroadcastTestAction: a.sendBroadcastTestAction, saveTemplateAction: vi.fn(), resetTemplateAction: vi.fn(), cancelBroadcastAction: vi.fn() }));
vi.mock("@admin/app/(panel)/ustawienia/actions", () => ({ saveThresholdsAction: a.saveThresholdsAction, resetThresholdsAction: a.resetThresholdsAction }));

import { RefundButton } from "@admin/components/revenue/refund-button";
import { BroadcastWizard } from "@admin/components/comms/broadcast-wizard";
import { ThresholdsForm } from "@admin/components/settings/thresholds-form";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

const target = { id: "p1", email: "a@x.pl", currency: "PLN", amountLabel: "50,00 zł", leftMinor: 4000, leftLabel: "40,00 zł" };

describe("RefundButton", () => {
  it("sends mode, reason and a fresh idempotency key; a refused step-up goes to /potwierdz", async () => {
    a.refundAction.mockResolvedValue({ ok: false, code: "STEP_UP_REQUIRED", message: "x" });
    render(<RefundButton target={target} returnTo="/przychody?tab=wplaty" />);
    fireEvent.click(screen.getByRole("button", { name: /Zwrot wpłaty/ }));
    fireEvent.change(screen.getByLabelText("Opis powodu (do audytu)"), { target: { value: "prośba wspierającego" } });
    fireEvent.submit(screen.getByRole("button", { name: "Zwróć pieniądze" }).closest("form")!);
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/potwierdz?next=${encodeURIComponent("/przychody?tab=wplaty")}`));
    expect(a.refundAction).toHaveBeenCalledWith(expect.objectContaining({ paymentId: "p1", mode: "full", note: "prośba wspierającego", stripeReason: "requested_by_customer", idempotencyKey: expect.stringMatching(/^[0-9a-f-]{36}$/) }));
  });

  it("shows the amount field only for a partial refund and prints field errors from the server", async () => {
    a.refundAction.mockResolvedValue({ ok: false, message: "Popraw", fieldErrors: { amount: "Do zwrotu zostało 40,00 zł." } });
    render(<RefundButton target={target} returnTo="/x" />);
    fireEvent.click(screen.getByRole("button", { name: /Zwrot wpłaty/ }));
    expect(screen.queryByLabelText(/Kwota zwrotu/)).toBeNull();
    fireEvent.click(screen.getByLabelText("Część kwoty"));
    fireEvent.change(screen.getByLabelText(/Kwota zwrotu/), { target: { value: "99" } });
    fireEvent.submit(screen.getByRole("button", { name: "Zwróć pieniądze" }).closest("form")!);
    await waitFor(() => expect(screen.getByText("Do zwrotu zostało 40,00 zł.")).toBeInTheDocument());
    expect(a.refundAction).toHaveBeenCalledWith(expect.objectContaining({ mode: "partial", amount: "99" }));
  });

  it("uses a new key each time the dialog is opened", async () => {
    a.refundAction.mockResolvedValue({ ok: false, message: "boom" });
    render(<RefundButton target={target} returnTo="/x" />);
    const keys: string[] = [];
    for (let i = 0; i < 2; i++) {
      fireEvent.click(screen.getByRole("button", { name: /Zwrot wpłaty/ }));
      fireEvent.change(screen.getByLabelText("Opis powodu (do audytu)"), { target: { value: "powód testowy" } });
      fireEvent.submit(screen.getByRole("button", { name: "Zwróć pieniądze" }).closest("form")!);
      await waitFor(() => expect(a.refundAction).toHaveBeenCalledTimes(i + 1));
      keys.push(a.refundAction.mock.calls[i][0].idempotencyKey);
      fireEvent.click(screen.getAllByRole("button", { name: "Anuluj" })[0]);
    }
    expect(keys[0]).not.toBe(keys[1]);
  });
});

describe("BroadcastWizard", () => {
  it("blocks step 2 until Polish content exists, a half English version is refused, and sending asks for step-up", async () => {
    a.createBroadcastAction.mockResolvedValue({ ok: false, code: "STEP_UP_REQUIRED", message: "x" });
    render(<BroadcastWizard audience={31} email="owner@example.com" />);
    expect(screen.getByText("31")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Dalej" }));
    fireEvent.click(screen.getByRole("button", { name: "Dalej" }));
    expect(screen.getByText("Podaj temat po polsku.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Temat (PL)"), { target: { value: "Premiera" } });
    fireEvent.change(screen.getByLabelText("Treść (PL, HTML)"), { target: { value: "<p>Hej</p>" } });
    fireEvent.change(screen.getByLabelText("Temat (EN)"), { target: { value: "Premiere" } });
    fireEvent.click(screen.getByRole("button", { name: "Dalej" }));
    expect(screen.getByText(/Wersja angielska musi mieć/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Temat (EN)"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Dalej" }));
    expect(screen.getByText(/owner@example.com/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Dalej" }));
    fireEvent.click(screen.getByRole("button", { name: "Dalej: potwierdź i wyślij" }));
    fireEvent.submit(screen.getByRole("button", { name: "Wyślij rozsyłkę" }).closest("form")!);
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/potwierdz?next=${encodeURIComponent("/komunikacja?tab=rozsylki")}`));
    expect(a.createBroadcastAction).toHaveBeenCalledWith(expect.objectContaining({ subjectPl: "Premiera", requestKey: expect.any(String) }));
  });

  it("cannot proceed with no recipients", () => {
    render(<BroadcastWizard audience={0} email="o@x" />);
    expect(screen.getByRole("button", { name: "Dalej" })).toBeDisabled();
  });
});

describe("ThresholdsForm", () => {
  it("shows server field errors next to the field", async () => {
    a.saveThresholdsAction.mockResolvedValue({ ok: false, message: "Popraw", fieldErrors: { "disk.critAt": "Próg błędu musi być wyższy niż próg ostrzeżenia." } });
    render(<ThresholdsForm custom rows={[{ key: "disk", label: "Dysk", hint: "h", warnAt: 80, critAt: 90 }]} />);
    fireEvent.submit(screen.getByRole("button", { name: "Zapisz" }).closest("form")!);
    await waitFor(() => expect(screen.getByText(/musi być wyższy/)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Przywróć domyślne" })).toBeInTheDocument();
  });
});
