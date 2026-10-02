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

  it("lists PL, EN, DE, FR, ES and IT and switches to a supported one", () => {
    const onSelect = vi.fn();
    render(<LanguageSwitcher language="pl" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button"));
    for (const label of ["Polski", "English", "Deutsch", "Français", "Español", "Italiano"]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    fireEvent.click(screen.getByText("English"));
    expect(onSelect).toHaveBeenCalledWith("en");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("looks like Italian is selectable, shows its code, but does not switch the site", () => {
    const onSelect = vi.fn();
    render(<LanguageSwitcher language="en" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button"));
    const italian = screen.getByText("Italiano").closest("button") as HTMLButtonElement;
    expect(italian.disabled).toBe(false);
    expect(screen.queryByText("soon")).toBeNull();

    fireEvent.click(italian);
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByText("IT")).toBeTruthy();
    expect(screen.getByText(/Italiano translation is in progress/)).toBeTruthy();
  });

  it("explains in Polish when the site language is Polish", () => {
    render(<LanguageSwitcher language="pl" onSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(screen.getByText("Deutsch"));
    expect(screen.getByText(/Tłumaczenie na Deutsch jest w przygotowaniu/)).toBeTruthy();
  });

  it("goes back to a real language after choosing it again", () => {
    const onSelect = vi.fn();
    render(<LanguageSwitcher language="pl" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(screen.getByText("Français"));
    expect(screen.getByText("FR")).toBeTruthy();
    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(screen.getByText("Polski"));
    expect(onSelect).toHaveBeenCalledWith("pl");
    expect(screen.queryByText(/w przygotowaniu/)).toBeNull();
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
