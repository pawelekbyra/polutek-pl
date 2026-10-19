"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export type ChannelTabId = "videos" | "about";

const ORDER: ChannelTabId[] = ["videos", "about"];

/** `?tab=about` or `#about` opens the About tab; anything else is Videos. */
export function tabFromLocation(search: string, hash: string): ChannelTabId {
  const fromQuery = new URLSearchParams(search).get("tab");
  if (fromQuery === "about") return "about";
  if (hash.replace(/^#/, "") === "about") return "about";
  return "videos";
}

/**
 * Videos / About tabs of a public channel page. Both panels are rendered on the server (so the About text is in the
 * HTML for search engines); the tab only decides which one is visible. WAI-ARIA tabs pattern: arrow keys, Home and
 * End move between tabs, the selected tab is the only one in the tab order. The choice is mirrored in `?tab=about`.
 */
export default function ChannelTabs({
  labels,
  ariaLabel,
  videos,
  about,
}: {
  labels: Record<ChannelTabId, string>;
  ariaLabel: string;
  videos: ReactNode;
  about: ReactNode;
}) {
  const [active, setActive] = useState<ChannelTabId>("videos");
  const buttons = useRef<Record<ChannelTabId, HTMLButtonElement | null>>({ videos: null, about: null });

  useEffect(() => {
    const sync = () => setActive(tabFromLocation(window.location.search, window.location.hash));
    sync();
    window.addEventListener("popstate", sync);
    window.addEventListener("hashchange", sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("hashchange", sync);
    };
  }, []);

  const select = useCallback((id: ChannelTabId, focus = false) => {
    setActive(id);
    try {
      const url = new URL(window.location.href);
      if (id === "about") url.searchParams.set("tab", "about");
      else url.searchParams.delete("tab");
      url.hash = "";
      window.history.replaceState(null, "", url.pathname + url.search);
    } catch {
      /* history is optional */
    }
    if (focus) buttons.current[id]?.focus();
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next: number | null = null;
    if (event.key === "ArrowRight") next = (index + 1) % ORDER.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + ORDER.length) % ORDER.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = ORDER.length - 1;
    if (next === null) return;
    event.preventDefault();
    select(ORDER[next], true);
  };

  return (
    <div>
      <div
        role="tablist"
        aria-label={ariaLabel}
        className="channel-tabs flex border-b border-[var(--chan-line)] mt-7 overflow-x-auto no-scrollbar gap-8"
      >
        {ORDER.map((id, index) => {
          const selected = active === id;
          return (
            <button
              key={id}
              ref={(node) => {
                buttons.current[id] = node;
              }}
              type="button"
              role="tab"
              id={`channel-tab-${id}`}
              aria-selected={selected}
              aria-controls={`channel-panel-${id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(id)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={`pb-3 border-b-2 text-[13px] font-bold uppercase tracking-[0.14em] font-sans whitespace-nowrap rounded-t-lg px-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--chan-ink)] ${
                selected ? "channel-tab-active border-[var(--chan-ink)] text-[var(--chan-ink)]" : "border-transparent text-[var(--chan-muted)] hover:text-[var(--chan-ink)]"
              }`}
            >
              {labels[id]}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id="channel-panel-videos" aria-labelledby="channel-tab-videos" hidden={active !== "videos"}>
        {videos}
      </div>
      <div role="tabpanel" id="channel-panel-about" aria-labelledby="channel-tab-about" hidden={active !== "about"}>
        {about}
      </div>
    </div>
  );
}
