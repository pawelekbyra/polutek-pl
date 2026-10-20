/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { LanguageProvider } from "@/app/components/LanguageContext";
import { LinkedDescription } from "@/app/components/video/LinkedDescription";
import { DescriptionChapters } from "@/app/components/video/DescriptionChapters";
import { clearChapters, publishActiveChapter, publishChapters } from "@/app/components/player/chapters-store";
import { SEEK_REQUEST_EVENT, requestSeek, type SeekRequestDetail } from "@/app/components/player/seek-request";
import { CHAPTER_KEY_SHORTCUTS } from "@/app/components/player/chapters/chapter-keys";
import type { Chapter } from "@/lib/video-chapters";

const ID = "video-1";
const CHAPTERS: Chapter[] = [
  { startSeconds: 0, title: "Wstęp", titleEn: "Intro" },
  { startSeconds: 30, title: "Temat", titleEn: "Topic" },
  { startSeconds: 90, title: "Koniec" },
];
const MANY: Chapter[] = Array.from({ length: 8 }, (_, i) => ({ startSeconds: i * 60, title: `Rozdział ${i + 1}` }));

function seeks(): SeekRequestDetail[] {
  const received: SeekRequestDetail[] = [];
  window.addEventListener(SEEK_REQUEST_EVENT, (event) => received.push((event as CustomEvent<SeekRequestDetail>).detail));
  return received;
}

function renderIn(ui: React.ReactNode, language: "pl" | "en" = "pl") {
  return render(<LanguageProvider initialLanguage={language}>{ui}</LanguageProvider>);
}

afterEach(() => {
  cleanup();
  clearChapters(ID);
});

describe("LinkedDescription", () => {
  it("renders plain text while no player is mounted for the video (guest, premiere)", () => {
    renderIn(<LinkedDescription text="Zobacz 1:30 i 2:00" videoId={ID} />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.getByText("Zobacz 1:30 i 2:00")).toBeTruthy();
  });

  it("turns the times into jump buttons once the player is there, keeping the text around them", () => {
    publishChapters(ID, [], 1000);
    const { container } = renderIn(<LinkedDescription text="Zobacz 1:30 i 12:30 koniec" videoId={ID} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual(["1:30", "12:30"]);
    expect(buttons[0].getAttribute("aria-label")).toBe("Przejdź do 1:30");
    expect(container.textContent).toBe("Zobacz 1:30 i 12:30 koniec");
  });

  it("leaves a time beyond the end of the video as text", () => {
    publishChapters(ID, [], 100);
    renderIn(<LinkedDescription text="0:30 oraz 59:59" videoId={ID} />);
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["0:30"]);
  });

  it("asks the player for the jump and does not fold the card around it", () => {
    publishChapters(ID, CHAPTERS, 600);
    const received = seeks();
    const onCard = vi.fn();
    renderIn(<div onClick={onCard}><LinkedDescription text="Start 2:05" videoId={ID} /></div>);
    fireEvent.click(screen.getByRole("button"));
    expect(received.at(-1)).toEqual({ videoId: ID, seconds: 125 });
    expect(onCard).not.toHaveBeenCalled();
  });
});

describe("DescriptionChapters", () => {
  it("renders nothing without chapters", () => {
    publishChapters(ID, [], 600);
    const { container } = renderIn(<DescriptionChapters videoId={ID} />);
    expect(container.textContent).toBe("");
  });

  it("lists the chapters in the page language, marks the one being played and jumps on a click", () => {
    publishChapters(ID, CHAPTERS, 600);
    publishActiveChapter(ID, 1);
    const received = seeks();
    const onCard = vi.fn();
    renderIn(<div onClick={onCard}><DescriptionChapters videoId={ID} /></div>, "en");
    expect(screen.getByText("Intro")).toBeTruthy();
    expect(screen.getByText("Koniec")).toBeTruthy(); // no English title: the Polish one
    const topic = screen.getByText("Topic").closest("button")!;
    expect(topic.getAttribute("aria-current")).toBe("true");
    fireEvent.click(screen.getByText("Koniec"));
    expect(received.at(-1)).toEqual({ videoId: ID, seconds: 90 });
    expect(onCard).not.toHaveBeenCalled();
  });

  it("folds a long list to five and unfolds it", () => {
    publishChapters(ID, MANY, 900);
    renderIn(<DescriptionChapters videoId={ID} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
    const toggle = screen.getByRole("button", { name: "Pokaż wszystkie (8)" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle);
    expect(screen.getAllByRole("listitem")).toHaveLength(8);
    expect(screen.getByRole("button", { name: "Pokaż mniej" }).getAttribute("aria-expanded")).toBe("true");
  });

  it("follows the store: the list appears when the player publishes and goes when it clears", () => {
    renderIn(<DescriptionChapters videoId={ID} />);
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    act(() => publishChapters(ID, CHAPTERS, 600));
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    act(() => clearChapters(ID));
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });
});

describe("requestSeek", () => {
  it("ignores a time that is not a number of seconds", () => {
    const received = seeks();
    const before = received.length;
    requestSeek(ID, Number.NaN);
    requestSeek(ID, -5);
    expect(received.length).toBe(before);
  });
});

describe("chapter keyboard shortcuts", () => {
  function fakePlayer(currentTime: number) {
    const cues = CHAPTERS.map((c) => ({ startTime: c.startSeconds, text: c.title }));
    return {
      textTracks: [{ kind: "chapters", mode: "showing", cues }],
      currentTime,
      duration: 600,
      state: { ended: false },
      play: vi.fn(),
    };
  }
  const key = () => ({ preventDefault: vi.fn(), stopPropagation: vi.fn() }) as unknown as KeyboardEvent;

  it("uses YouTube's keys plus the brackets", () => {
    expect(CHAPTER_KEY_SHORTCUTS.nextChapter.keys.split(" ")).toEqual(["Ctrl+ArrowRight", "Alt+ArrowRight", "]"]);
    expect(CHAPTER_KEY_SHORTCUTS.previousChapter.keys.split(" ")).toEqual(["Ctrl+ArrowLeft", "Alt+ArrowLeft", "["]);
  });

  it("jumps to the next chapter and cancels the key", () => {
    const player = fakePlayer(10);
    const event = key();
    CHAPTER_KEY_SHORTCUTS.nextChapter.onKeyDown({ event, player: player as never });
    expect(player.currentTime).toBe(30);
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it("restarts a chapter that has run for more than three seconds, otherwise goes back one", () => {
    const later = fakePlayer(40);
    CHAPTER_KEY_SHORTCUTS.previousChapter.onKeyDown({ event: key(), player: later as never });
    expect(later.currentTime).toBe(30);
    const early = fakePlayer(31);
    CHAPTER_KEY_SHORTCUTS.previousChapter.onKeyDown({ event: key(), player: early as never });
    expect(early.currentTime).toBe(0);
  });

  it("does nothing, and leaves the key alone, on the last chapter or without chapters", () => {
    const last = fakePlayer(100);
    const event = key();
    CHAPTER_KEY_SHORTCUTS.nextChapter.onKeyDown({ event, player: last as never });
    expect(last.currentTime).toBe(100);
    expect(event.preventDefault).not.toHaveBeenCalled();
    const none = { ...fakePlayer(5), textTracks: [] };
    CHAPTER_KEY_SHORTCUTS.nextChapter.onKeyDown({ event, player: none as never });
    expect(none.currentTime).toBe(5);
  });
});
