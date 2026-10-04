/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import React from "react";
import LanguageSwitcher from "@/app/components/LanguageSwitcher";
import { LANGUAGE_OPTIONS, startsWithTyped } from "@/app/components/language-switcher/languages";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const trigger = () => screen.getByRole("button", { name: /Zmień język|Change language/ });
const listbox = () => screen.getByRole("listbox");
const activeOption = () => {
  const id = listbox().getAttribute("aria-activedescendant");
  return id ? document.getElementById(id) : null;
};
const flagSrcs = (root: ParentNode = document) =>
  Array.from(root.querySelectorAll("img")).map((img) => img.getAttribute("src"));

describe("LanguageSwitcher (navbar pill)", () => {
  it("shows a globe and the current code, no flag, with the list closed", () => {
    render(<LanguageSwitcher language="pl" onSelect={vi.fn()} />);
    expect(screen.getByText("PL")).toBeTruthy();
    expect(trigger().querySelector("svg.lucide-globe")).toBeTruthy();
    expect(trigger().querySelector("img")).toBeNull();
    expect(flagSrcs()).toEqual([]);
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
  });

  it("opens a list of eight languages with flags, names and codes, focused on the current language, with no search field", () => {
    render(<LanguageSwitcher language="pl" onSelect={vi.fn()} />);
    fireEvent.click(trigger());
    expect(trigger().getAttribute("aria-expanded")).toBe("true");
    expect(trigger().getAttribute("aria-controls")).toBe(listbox().id);
    expect(listbox().getAttribute("aria-label")).toBe("Języki");
    expect(document.activeElement).toBe(listbox());
    expect(activeOption()?.textContent).toBe("PolskiPL");
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByPlaceholderText(/Szukaj/)).toBeNull();

    const options = screen.getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual([
      "PolskiPL", "EnglishEN", "DeutschDE", "EspañolES", "FrançaisFR", "ItalianoIT", "PortuguêsPT", "中文ZH",
    ]);
    // Accessible name = the language name; the code is hidden from screen readers, flags are decorative.
    expect(options[2].querySelector("[aria-hidden='true']")?.textContent).toBe("DE");
    expect(options[2].querySelector("[lang='de']")?.textContent).toBe("Deutsch");
    expect(options.every((o) => o.querySelector("img")?.getAttribute("alt") === "")).toBe(true);
    expect(flagSrcs(listbox())).toEqual(LANGUAGE_OPTIONS.map((o) => `/flags/${o.flag}.svg`));
  });

  it("uses the British flag for English in the list and starts on the selected language", () => {
    render(<LanguageSwitcher language="en" onSelect={vi.fn()} />);
    fireEvent.click(trigger());
    const selected = screen.getAllByRole("option").filter((o) => o.getAttribute("aria-selected") === "true");
    expect(selected).toHaveLength(1);
    expect(selected[0].textContent).toBe("EnglishEN");
    expect(selected[0].querySelector("img")?.getAttribute("src")).toBe("/flags/gb.svg");
    expect(activeOption()).toBe(selected[0]);
  });

  it("switches to a real language on click, closes and returns focus to the button", () => {
    const onSelect = vi.fn();
    render(<LanguageSwitcher language="pl" onSelect={onSelect} />);
    fireEvent.click(trigger());
    fireEvent.click(screen.getByText("English"));
    expect(onSelect).toHaveBeenCalledWith("en");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it("keeps the site language for an untranslated one, shows its code (still a globe) and a note", () => {
    const onSelect = vi.fn();
    render(<LanguageSwitcher language="en" onSelect={onSelect} />);
    fireEvent.click(trigger());
    fireEvent.click(screen.getByText("Italiano"));
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByText("IT")).toBeTruthy();
    expect(trigger().querySelector("img")).toBeNull();
    expect(screen.getByText(/Italiano translation is in progress/)).toBeTruthy();
  });

  it("explains in Polish and goes back to a real language when chosen again", () => {
    const onSelect = vi.fn();
    render(<LanguageSwitcher language="pl" onSelect={onSelect} />);
    fireEvent.click(trigger());
    fireEvent.click(screen.getByText("Deutsch"));
    expect(screen.getByText(/Tłumaczenie na Deutsch jest w przygotowaniu/)).toBeTruthy();
    fireEvent.click(trigger());
    fireEvent.click(screen.getByText("Polski"));
    expect(onSelect).toHaveBeenCalledWith("pl");
    expect(screen.queryByText(/w przygotowaniu/)).toBeNull();
    expect(screen.getByText("PL")).toBeTruthy();
  });

  it("moves with arrows (wrapping), Home and End, and Enter picks the active language", () => {
    const onSelect = vi.fn();
    render(<LanguageSwitcher language="pl" onSelect={onSelect} />);
    fireEvent.click(trigger());
    fireEvent.keyDown(listbox(), { key: "ArrowDown" });
    expect(activeOption()?.textContent).toBe("EnglishEN");
    expect(activeOption()?.getAttribute("data-active")).toBe("true");
    fireEvent.keyDown(listbox(), { key: "End" });
    expect(activeOption()?.textContent).toBe("中文ZH");
    fireEvent.keyDown(listbox(), { key: "ArrowDown" });
    expect(activeOption()?.textContent).toBe("PolskiPL");
    fireEvent.keyDown(listbox(), { key: "ArrowUp" });
    expect(activeOption()?.textContent).toBe("中文ZH");
    fireEvent.keyDown(listbox(), { key: "Home" });
    fireEvent.keyDown(listbox(), { key: "ArrowDown" });
    fireEvent.keyDown(listbox(), { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith("en");
  });

  it("jumps to a language by its first letter, cycling through matches", () => {
    let now = 1_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    render(<LanguageSwitcher language="pl" onSelect={vi.fn()} />);
    fireEvent.click(trigger());
    fireEvent.keyDown(listbox(), { key: "f" });
    expect(activeOption()?.textContent).toBe("FrançaisFR");
    now += 1000;
    fireEvent.keyDown(listbox(), { key: "E" });
    expect(activeOption()?.textContent).toBe("EnglishEN");
    now += 1000;
    fireEvent.keyDown(listbox(), { key: "e" });
    expect(activeOption()?.textContent).toBe("EspañolES");
    // Letters typed quickly form one prefix.
    now += 1000;
    fireEvent.keyDown(listbox(), { key: "p" });
    now += 100;
    fireEvent.keyDown(listbox(), { key: "o" });
    now += 100;
    fireEvent.keyDown(listbox(), { key: "r" });
    expect(activeOption()?.textContent).toBe("PortuguêsPT");
  });

  it("closes on Escape and returns focus to the button, and closes on an outside press", () => {
    render(<LanguageSwitcher language="en" onSelect={vi.fn()} />);
    fireEvent.click(trigger());
    fireEvent.keyDown(listbox(), { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(document.activeElement).toBe(trigger());
    fireEvent.click(trigger());
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("is a capped, scrollable list that fits a phone screen", () => {
    render(<LanguageSwitcher language="pl" onSelect={vi.fn()} />);
    fireEvent.click(trigger());
    expect(listbox().className).toContain("overflow-y-auto");
    expect(listbox().className).toContain("max-h-");
    const panel = listbox().parentElement as HTMLElement;
    // Full width under the navbar on phones, anchored to the pill from the sm breakpoint.
    expect(panel.className).toMatch(/\bfixed left-2 right-2\b/);
    expect(panel.className).toContain("sm:absolute");
    // 44 px touch targets on phones.
    expect(screen.getAllByRole("option").every((o) => o.className.includes("min-h-11"))).toBe(true);
  });

  it("loads nothing but local flag files", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<LanguageSwitcher language="pl" onSelect={vi.fn()} />);
    fireEvent.pointerEnter(trigger());
    fireEvent.click(trigger());
    expect(fetchSpy).not.toHaveBeenCalled();
    const srcs = flagSrcs();
    expect(srcs).toHaveLength(8);
    expect(srcs.every((src) => /^\/flags\/[a-z]{2}\.svg$/.test(src ?? ""))).toBe(true);
  });
});

describe("startsWithTyped", () => {
  it("matches the start of the name or the code, ignoring case", () => {
    const de = LANGUAGE_OPTIONS.find((o) => o.code === "DE")!;
    expect(startsWithTyped(de, "deu")).toBe(true);
    expect(startsWithTyped(de, "D")).toBe(true);
    expect(startsWithTyped(de, "eu")).toBe(false);
    const zh = LANGUAGE_OPTIONS.find((o) => o.code === "ZH")!;
    expect(startsWithTyped(zh, "z")).toBe(true);
  });
});
