/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadCatalog } from "@/lib/i18n/catalog";
import { createTx } from "@/lib/i18n/ui";
import { SUPPORTED_LOCALES, type Locale } from "@/lib/i18n/routing";
import { BetaNotice } from "@/app/components/BetaNotice";

const state: { tx: ReturnType<typeof createTx> } = { tx: createTx("pl") };
vi.mock("@/app/components/LanguageContext", () => ({ useLanguage: () => ({ tx: state.tx }) }));

async function renderIn(locale: Locale, beta?: boolean) {
  state.tx = createTx(locale, await loadCatalog(locale));
  return render(<BetaNotice beta={beta} />);
}

describe("BetaNotice", () => {
  afterEach(() => cleanup());

  it("is a role=note strip with the Polish and English text", async () => {
    await renderIn("pl", true);
    expect(screen.getByRole("note").textContent).toBe("Strona w budowie (wersja testowa)");
    cleanup();
    await renderIn("en", true);
    expect(screen.getByRole("note").textContent).toBe("Under construction (test version)");
  });

  it("has a translation in every interface language (never the English source)", async () => {
    const seen = new Set<string>();
    for (const locale of SUPPORTED_LOCALES) {
      cleanup();
      await renderIn(locale, true);
      seen.add(screen.getByRole("note").textContent ?? "");
    }
    expect(seen.size).toBe(SUPPORTED_LOCALES.length);
  });

  it("renders nothing when beta is off", async () => {
    const { container } = await renderIn("pl", false);
    expect(container.innerHTML).toBe("");
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("has a fixed height and is not interactive (no layout shift, covers nothing)", async () => {
    await renderIn("en", true);
    const note = screen.getByRole("note");
    expect(note.className).toMatch(/\bh-6\b/);
    expect(note.querySelector("a,button,input")).toBeNull();
  });
});
