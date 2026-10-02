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

  it("lists the eight languages and switches to a supported one", () => {
    const onSelect = vi.fn();
    render(<LanguageSwitcher language="pl" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button"));
    for (const label of ["Polski", "English", "Deutsch", "Español", "Français", "Italiano", "Português", "中文"]) {
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

  it("has a search field that filters the list, ignoring accents and case", () => {
    render(<LanguageSwitcher language="pl" onSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole("button"));
    const search = screen.getByPlaceholderText("Szukaj języka") as HTMLInputElement;
    fireEvent.change(search, { target: { value: "francais" } });
    expect(screen.getByText("Français")).toBeTruthy();
    expect(screen.queryByText("Deutsch")).toBeNull();

    fireEvent.change(search, { target: { value: "zh" } });
    expect(screen.getByText("中文")).toBeTruthy();
    expect(screen.queryByText("Polski")).toBeNull();
  });

  it("shows a message when nothing matches and picks the first result on Enter", () => {
    const onSelect = vi.fn();
    render(<LanguageSwitcher language="en" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button"));
    const search = screen.getByPlaceholderText("Search language") as HTMLInputElement;
    fireEvent.change(search, { target: { value: "xyz" } });
    expect(screen.getByText("No results")).toBeTruthy();

    fireEvent.change(search, { target: { value: "pol" } });
    fireEvent.keyDown(search, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith("pl");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("makes the list scrollable with a capped height", () => {
    render(<LanguageSwitcher language="pl" onSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole("button"));
    const menu = screen.getByRole("menu");
    expect(menu.className).toContain("overflow-y-auto");
    expect(menu.className).toContain("max-h-");
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
