/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import React from "react";
import CheckInboxView from "@/app/components/auth/CheckInboxView";
import LanguageSwitcher from "@/app/components/LanguageSwitcher";

afterEach(() => cleanup());

describe("CheckInboxView", () => {
  it("shows the address, the steps and the spam hint for sign-up", () => {
    render(<CheckInboxView isPl={false} kind="verify" email="jan@hotmail.com" onBack={vi.fn()} />);
    expect(screen.getByText("jan@hotmail.com")).toBeTruthy();
    expect(screen.getByText(/Click the confirmation link/)).toBeTruthy();
    expect(screen.getByText(/Spam or Junk folder/)).toBeTruthy();
  });

  it("offers resend, a different address and going back", () => {
    const onResend = vi.fn();
    const onChangeEmail = vi.fn();
    const onBack = vi.fn();
    render(<CheckInboxView isPl kind="verify" email="a@b.pl" onResend={onResend} onChangeEmail={onChangeEmail} onBack={onBack} />);
    fireEvent.click(screen.getByText("Wyślij link ponownie"));
    fireEvent.click(screen.getByText("Zły adres? Wpisz inny"));
    fireEvent.click(screen.getByText("Wróć do logowania"));
    expect(onResend).toHaveBeenCalledOnce();
    expect(onChangeEmail).toHaveBeenCalledOnce();
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("uses reset wording and hides resend when no handler is given", () => {
    render(<CheckInboxView isPl={false} kind="reset" email="x@y.com" onBack={vi.fn()} />);
    expect(screen.getByText(/password link to/)).toBeTruthy();
    expect(screen.queryByText("Send the link again")).toBeNull();
  });
});

describe("LanguageSwitcher inline variant", () => {
  const active = (listbox: HTMLElement) => document.getElementById(listbox.getAttribute("aria-activedescendant") ?? "");

  it("renders a Language: link with the current flag that expands the list in the page flow and switches", () => {
    const onSelect = vi.fn();
    render(<LanguageSwitcher variant="inline" language="en" onSelect={onSelect} />);
    expect(screen.getByText("Language:")).toBeTruthy();
    const button = screen.getByRole("button");
    expect(button.querySelector("img")?.getAttribute("src")).toBe("/flags/gb.svg");
    fireEvent.click(button);
    const listbox = screen.getByRole("listbox");
    expect(listbox.className).toContain("relative");
    expect(listbox.className).not.toContain("absolute");
    expect(screen.queryByRole("combobox")).toBeNull();
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(8);
    expect(options.every((o) => o.querySelector("img")?.getAttribute("src")?.startsWith("/flags/"))).toBe(true);
    fireEvent.click(screen.getByText("Polski"));
    expect(onSelect).toHaveBeenCalledWith("pl");
  });

  it("is compact, supports arrow keys, type-ahead and Esc, and keeps placeholder languages non-switching", () => {
    const onSelect = vi.fn();
    render(<LanguageSwitcher variant="inline" language="en" onSelect={onSelect} />);
    const button = screen.getByRole("button");
    fireEvent.click(button);
    const listbox = screen.getByRole("listbox");
    expect(listbox.className).not.toContain("shadow");
    expect(listbox.className).not.toContain("border");
    expect(screen.getAllByRole("option")[0].className).toContain("text-[12px]");
    expect(document.activeElement).toBe(listbox);
    expect(active(listbox)?.textContent).toBe("English");
    fireEvent.keyDown(listbox, { key: "ArrowRight" });
    expect(active(listbox)?.textContent).toBe("Deutsch");
    fireEvent.keyDown(listbox, { key: "p" });
    expect(active(listbox)?.textContent).toBe("Português");
    fireEvent.keyDown(listbox, { key: "Home" });
    expect(active(listbox)?.textContent).toBe("Polski");
    fireEvent.keyDown(listbox, { key: "End" });
    fireEvent.keyDown(listbox, { key: "ArrowLeft" });
    fireEvent.keyDown(listbox, { key: "Enter" });
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByText(/Português translation is in progress/)).toBeTruthy();
    expect(document.activeElement).toBe(button);
    fireEvent.click(button);
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(document.activeElement).toBe(button);
  });
});
