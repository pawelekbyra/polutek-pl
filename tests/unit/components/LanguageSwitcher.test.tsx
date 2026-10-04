/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import React from "react";
import LanguageSwitcher from "@/app/components/LanguageSwitcher";
import { filterLanguages, LANGUAGE_OPTIONS } from "@/app/components/language-switcher/languages";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const trigger = () => screen.getByRole("button", { name: /Zmień język|Change language/ });
const search = () => screen.getByRole("combobox") as HTMLInputElement;
const activeOption = () => {
  const id = search().getAttribute("aria-activedescendant");
  return id ? document.getElementById(id) : null;
};
const flagSrcs = (root: ParentNode = document) =>
  Array.from(root.querySelectorAll("img")).map((img) => img.getAttribute("src"));

describe("LanguageSwitcher (navbar pill)", () => {
  it("shows the current language's flag and code, with the list closed", () => {
    render(<LanguageSwitcher language="pl" onSelect={vi.fn()} />);
    expect(screen.getByText("PL")).toBeTruthy();
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
    const flag = trigger().querySelector("img") as HTMLImageElement;
    expect(flag.getAttribute("src")).toBe("/flags/pl.svg");
    expect(flag.getAttribute("alt")).toBe("");
    expect(flag.getAttribute("width")).toBe("20");
    expect(flag.getAttribute("height")).toBe("20");
    // Only the current flag is on the page until the list opens.
    expect(flagSrcs()).toEqual(["/flags/pl.svg"]);
  });

  it("uses the British flag for English", () => {
    render(<LanguageSwitcher language="en" onSelect={vi.fn()} />);
    expect(trigger().querySelector("img")?.getAttribute("src")).toBe("/flags/gb.svg");
  });

  it("opens a searchable list of eight languages with flags, names and codes, focused on the search field", () => {
    render(<LanguageSwitcher language="pl" onSelect={vi.fn()} />);
    fireEvent.click(trigger());
    expect(trigger().getAttribute("aria-expanded")).toBe("true");
    const listbox = screen.getByRole("listbox", { name: "Języki" });
    expect(trigger().getAttribute("aria-controls")).toBe(listbox.id);
    expect(search().getAttribute("aria-controls")).toBe(listbox.id);
    expect(document.activeElement).toBe(search());
    expect(search().placeholder).toBe("Szukaj języka…");

    const options = screen.getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual([
      "PolskiPL", "EnglishEN", "DeutschDE", "EspañolES", "FrançaisFR", "ItalianoIT", "PortuguêsPT", "中文ZH",
    ]);
    // Accessible name = the language name; the code is hidden from screen readers, flags are decorative.
    expect(options[2].querySelector("[aria-hidden='true']")?.textContent).toBe("DE");
    expect(options[2].querySelector("[lang='de']")?.textContent).toBe("Deutsch");
    expect(options.every((o) => o.querySelector("img")?.getAttribute("alt") === "")).toBe(true);
    expect(flagSrcs(listbox)).toEqual(LANGUAGE_OPTIONS.map((o) => `/flags/${o.flag}.svg`));
  });

  it("marks the current language as selected and starts there", () => {
    render(<LanguageSwitcher language="en" onSelect={vi.fn()} />);
    fireEvent.click(trigger());
    const selected = screen.getAllByRole("option").filter((o) => o.getAttribute("aria-selected") === "true");
    expect(selected).toHaveLength(1);
    expect(selected[0].textContent).toContain("English");
    expect(activeOption()?.textContent).toContain("English");
  });

  it("switches to a real language on click and closes", () => {
    const onSelect = vi.fn();
    render(<LanguageSwitcher language="pl" onSelect={onSelect} />);
    fireEvent.click(trigger());
    fireEvent.click(screen.getByText("English"));
    expect(onSelect).toHaveBeenCalledWith("en");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it("keeps the site language for an untranslated one, shows its flag and code and a note", () => {
    const onSelect = vi.fn();
    render(<LanguageSwitcher language="en" onSelect={onSelect} />);
    fireEvent.click(trigger());
    fireEvent.click(screen.getByText("Italiano"));
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByText("IT")).toBeTruthy();
    expect(trigger().querySelector("img")?.getAttribute("src")).toBe("/flags/it.svg");
    expect(screen.getByText(/Italiano translation is in progress/)).toBeTruthy();
    expect(screen.queryByText(/soon/i)).toBeNull();
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

  it("filters while typing, ignoring accents and case, and matches codes", () => {
    render(<LanguageSwitcher language="pl" onSelect={vi.fn()} />);
    fireEvent.click(trigger());
    fireEvent.change(search(), { target: { value: "FRANCAIS" } });
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["FrançaisFR"]);
    fireEvent.change(search(), { target: { value: "portugues" } });
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["PortuguêsPT"]);
    fireEvent.change(search(), { target: { value: "zh" } });
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["中文ZH"]);
    expect(activeOption()?.textContent).toBe("中文ZH");
  });

  it("shows a message when nothing matches, and Enter picks the first result", () => {
    const onSelect = vi.fn();
    render(<LanguageSwitcher language="en" onSelect={onSelect} />);
    fireEvent.click(trigger());
    fireEvent.change(search(), { target: { value: "xyz" } });
    expect(screen.getByText("No results")).toBeTruthy();
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(search().getAttribute("aria-activedescendant")).toBeNull();
    fireEvent.change(search(), { target: { value: "pol" } });
    fireEvent.keyDown(search(), { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith("pl");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("moves with arrows (wrapping), Home and End, and Enter picks the active language", () => {
    const onSelect = vi.fn();
    render(<LanguageSwitcher language="pl" onSelect={onSelect} />);
    fireEvent.click(trigger());
    expect(activeOption()?.textContent).toBe("PolskiPL");
    fireEvent.keyDown(search(), { key: "ArrowDown" });
    expect(activeOption()?.textContent).toBe("EnglishEN");
    fireEvent.keyDown(search(), { key: "End" });
    expect(activeOption()?.textContent).toBe("中文ZH");
    fireEvent.keyDown(search(), { key: "ArrowDown" });
    expect(activeOption()?.textContent).toBe("PolskiPL");
    fireEvent.keyDown(search(), { key: "ArrowUp" });
    expect(activeOption()?.textContent).toBe("中文ZH");
    fireEvent.keyDown(search(), { key: "Home" });
    fireEvent.keyDown(search(), { key: "ArrowDown" });
    expect(activeOption()?.getAttribute("data-active")).toBe("true");
    fireEvent.keyDown(search(), { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith("en");
  });

  it("closes on Escape and returns focus to the button, and closes on an outside press", () => {
    render(<LanguageSwitcher language="en" onSelect={vi.fn()} />);
    fireEvent.click(trigger());
    fireEvent.keyDown(search(), { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(document.activeElement).toBe(trigger());
    fireEvent.click(trigger());
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("does not pop up the on-screen keyboard on touch screens: the list takes focus, typing goes to search", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query === "(pointer: coarse)", media: query }));
    try {
      render(<LanguageSwitcher language="pl" onSelect={vi.fn()} />);
      fireEvent.click(trigger());
      const listbox = screen.getByRole("listbox");
      expect(document.activeElement).toBe(listbox);
      fireEvent.keyDown(listbox, { key: "ArrowDown" });
      expect(listbox.getAttribute("aria-activedescendant")).toBe(screen.getByText("English").closest("[role='option']")?.id);
      fireEvent.keyDown(listbox, { key: "d" });
      expect(document.activeElement).toBe(search());
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("is a capped, scrollable list that fits a phone screen", () => {
    render(<LanguageSwitcher language="pl" onSelect={vi.fn()} />);
    fireEvent.click(trigger());
    const listbox = screen.getByRole("listbox");
    expect(listbox.className).toContain("overflow-y-auto");
    expect(listbox.className).toContain("max-h-");
    const panel = listbox.parentElement as HTMLElement;
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
    expect(srcs.length).toBe(9);
    expect(srcs.every((src) => /^\/flags\/[a-z]{2}\.svg$/.test(src ?? ""))).toBe(true);
  });
});

describe("filterLanguages", () => {
  it("returns every language for an empty query and matches without diacritics", () => {
    expect(filterLanguages("  ")).toHaveLength(8);
    expect(filterLanguages("espanol").map((o) => o.code)).toEqual(["ES"]);
    expect(filterLanguages("Ê").map((o) => o.code)).toEqual(["EN", "DE", "ES", "PT"]);
  });
});
