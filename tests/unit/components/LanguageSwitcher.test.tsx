/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import React from "react";
import LanguageSwitcher from "@/app/components/LanguageSwitcher";

afterEach(() => cleanup());

describe("LanguageSwitcher", () => {
  it("shows the current language code and keeps the list closed", () => {
    render(<LanguageSwitcher language="pl" onSelect={vi.fn()} />);
    expect(screen.getByText("PL")).toBeTruthy();
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.getByRole("button").getAttribute("aria-expanded")).toBe("false");
  });

  it("opens the list, lists the languages and switches to a supported one", () => {
    const onSelect = vi.fn();
    render(<LanguageSwitcher language="pl" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("menu")).toBeTruthy();
    expect(screen.getByText("Polski")).toBeTruthy();
    expect(screen.getByText("English")).toBeTruthy();
    expect(screen.getByText("Italiano")).toBeTruthy();

    fireEvent.click(screen.getByText("English"));
    expect(onSelect).toHaveBeenCalledWith("en");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("lists Italian as coming soon and does not switch to it", () => {
    const onSelect = vi.fn();
    render(<LanguageSwitcher language="en" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("soon")).toBeTruthy();
    const italian = screen.getByText("Italiano").closest("button") as HTMLButtonElement;
    expect(italian.disabled).toBe(true);
    fireEvent.click(italian);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("marks the current language and closes on Escape and on outside click", () => {
    render(<LanguageSwitcher language="en" onSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole("button"));
    const checked = screen.getAllByRole("menuitemradio").filter((el) => el.getAttribute("aria-checked") === "true");
    expect(checked).toHaveLength(1);
    expect(checked[0].textContent).toContain("English");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();

    fireEvent.click(screen.getByRole("button"));
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
