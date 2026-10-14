/** @vitest-environment jsdom */

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/components/LanguageContext", async () => {
  const { txFor } = await import("../i18n/mock-language");
  return { useLanguage: () => ({ language: "pl", tx: txFor("pl"), t: {} }) };
});
vi.mock("next/image", () => ({
  default: (props: { src: string; alt: string; className?: string }) =>
    React.createElement("img", { src: props.src, alt: props.alt, className: props.className }),
}));

import { ContinueWatchingShelf } from "@/app/components/channel/ContinueWatchingShelf";
import type { ContinueWatchingItem } from "@/lib/modules/watch-progress/domain/continue-watching";

const item = (n: number, over: Partial<ContinueWatchingItem> = {}): ContinueWatchingItem => ({
  videoId: `vid-${n}`,
  slug: `film-${n}`,
  title: `Film ${n}`,
  titleEn: null,
  thumbnailUrl: `/api/videos/vid-${n}/thumbnail`,
  channelName: "Kanał",
  positionSeconds: 125,
  durationSeconds: 500,
  fraction: 0.25,
  ...over,
});

describe("ContinueWatchingShelf", () => {
  afterEach(() => cleanup());

  it("renders nothing for an empty list", () => {
    const view = render(<ContinueWatchingShelf items={[]} onSelect={() => undefined} />);
    expect(view.container.firstChild).toBeNull();
  });

  it("lists the videos as links with a progress bar and square corners", () => {
    const view = render(<ContinueWatchingShelf items={[item(1), item(2, { fraction: null })]} onSelect={() => undefined} />);

    expect(screen.getByRole("heading", { name: "Kontynuuj oglądanie" })).toBeTruthy();
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links[0].getAttribute("href")).toBe("/?v=film-1");
    expect(links[0].getAttribute("aria-label")).toContain("2:05");

    // 25 % bar for the first, no bar when the length is unknown.
    const bars = view.container.querySelectorAll<HTMLElement>("[style*='width']");
    expect(bars).toHaveLength(1);
    expect(bars[0].style.width).toBe("25%");

    // The owner wants straight corners on thumbnails: nothing rounded in the shelf.
    expect(view.container.innerHTML).not.toMatch(/rounded-(?!none)/);
  });

  it("a plain click switches in place, a modified click is left to the browser", () => {
    const onSelect = vi.fn();
    render(<ContinueWatchingShelf items={[item(1)]} onSelect={onSelect} />);
    const link = screen.getByRole("link");

    // jsdom cannot navigate; the browser default is what a modified click leaves alone.
    link.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(link, { ctrlKey: true });
    expect(onSelect).not.toHaveBeenCalled();

    fireEvent.click(link);
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ videoId: "vid-1" }));
  });
});
