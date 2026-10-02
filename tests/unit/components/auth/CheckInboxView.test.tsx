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
  it("renders a Language: link that expands the list in the page flow and switches", () => {
    const onSelect = vi.fn();
    render(<LanguageSwitcher variant="inline" language="en" onSelect={onSelect} />);
    expect(screen.getByText("Language:")).toBeTruthy();
    fireEvent.click(screen.getByRole("button"));
    const menu = screen.getByRole("menu");
    expect(menu.className).toContain("relative");
    expect(menu.className).not.toContain("absolute");
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(screen.getAllByRole("menuitemradio")).toHaveLength(8);
    fireEvent.click(screen.getByText("PL"));
    expect(onSelect).toHaveBeenCalledWith("pl");
  });

  it("is compact, supports arrow keys and Esc, and keeps placeholder languages non-switching", () => {
    const onSelect = vi.fn();
    render(<LanguageSwitcher variant="inline" language="en" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button"));
    const menu = screen.getByRole("menu");
    expect(menu.className).not.toContain("overflow");
    expect(menu.className).not.toContain("shadow");
    expect(menu.className).not.toContain("border");
    const items = screen.getAllByRole("menuitemradio");
    expect(document.activeElement).toBe(items[1]);
    fireEvent.keyDown(items[1], { key: "ArrowRight" });
    expect(document.activeElement).toBe(items[2]);
    fireEvent.click(screen.getByText("DE"));
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByText(/DE translation is in progress/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button"));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
