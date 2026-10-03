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

  it("lists all eight language codes at once and switches to a supported one", () => {
    const onSelect = vi.fn();
    render(<LanguageSwitcher language="pl" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: /Język/ }));
    expect(screen.getAllByRole("menuitemradio").map((el) => el.textContent)).toEqual([
      "PL", "EN", "DE", "ES", "FR", "IT", "PT", "ZH",
    ]);
    for (const longName of ["Polski", "English", "Deutsch", "Español", "Français", "Italiano", "Português", "中文"]) {
      expect(screen.queryByText(longName)).toBeNull();
    }
    fireEvent.click(screen.getByRole("menuitemradio", { name: "English" }));
    expect(onSelect).toHaveBeenCalledWith("en");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("has no search field and no scrolling container", () => {
    render(<LanguageSwitcher language="pl" onSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(screen.queryByPlaceholderText("Szukaj języka")).toBeNull();
    const menu = screen.getByRole("menu");
    expect(menu.className).not.toContain("overflow");
    expect(menu.className).not.toContain("max-h-");
  });

  it("looks like Italian is selectable, shows its code, but does not switch the site", () => {
    const onSelect = vi.fn();
    render(<LanguageSwitcher language="en" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button"));
    const italian = screen.getByRole("menuitemradio", { name: "Italiano" }) as HTMLButtonElement;
    expect(italian.disabled).toBe(false);

    fireEvent.click(italian);
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByText("IT")).toBeTruthy();
    expect(screen.getByText(/IT translation is in progress. For now: EN/)).toBeTruthy();
  });

  it("explains in Polish when the site language is Polish", () => {
    render(<LanguageSwitcher language="pl" onSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(screen.getByText("DE"));
    expect(screen.getByText(/Tłumaczenie na DE jest w przygotowaniu. Na razie PL/)).toBeTruthy();
  });

  it("goes back to a real language after choosing it again", () => {
    const onSelect = vi.fn();
    render(<LanguageSwitcher language="pl" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(screen.getByText("FR"));
    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(screen.getByText("PL"));
    expect(onSelect).toHaveBeenCalledWith("pl");
    expect(screen.queryByText(/w przygotowaniu/)).toBeNull();
  });

  it("marks the current language and closes on Escape and on outside click", () => {
    render(<LanguageSwitcher language="en" onSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole("button"));
    const checked = screen.getAllByRole("menuitemradio").filter((el) => el.getAttribute("aria-checked") === "true");
    expect(checked).toHaveLength(1);
    expect(checked[0].textContent).toBe("EN");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    fireEvent.click(screen.getByRole("button"));
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
