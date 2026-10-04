/** @vitest-environment jsdom */

import React from "react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RenderClockProvider, useRenderClock } from "@/app/components/RenderClock";
import { initialCommentsData } from "@/app/components/comments/hooks/useComments";

function Stamp() {
  const now = useRenderClock();
  return <span>{now ? now.toISOString() : "none"}</span>;
}

afterEach(() => vi.restoreAllMocks());

describe("RenderClock", () => {
  const SERVER_NOW = "2026-10-04T10:00:00.000Z";

  it("renders the server's time in the HTML and hydrates the same text (no mismatch)", async () => {
    const tree = (
      <RenderClockProvider renderedAt={SERVER_NOW}>
        <Stamp />
      </RenderClockProvider>
    );
    const html = renderToString(tree);
    expect(html).toContain(SERVER_NOW);

    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.appendChild(container);
    const errors: unknown[] = [];
    await act(async () => {
      hydrateRoot(container, tree, { onRecoverableError: (e) => errors.push(e) });
    });
    // No hydration mismatch, and the live clock took over right after hydration.
    expect(errors).toEqual([]);
    expect(container.textContent).not.toBe(SERVER_NOW);
  });

  it("has no time on the server without a provider (nothing to swap in later)", () => {
    expect(renderToString(<Stamp />)).toContain("none");
  });
});

describe("server-rendered first page of comments", () => {
  const initial = { videoId: "v1", sortBy: "newest" as const, page: { success: true, comments: [], totalCount: 0 } };

  it("seeds only the query of that video and sort order", () => {
    expect(initialCommentsData(initial, "v1", "newest")?.pages).toEqual([initial.page]);
    expect(initialCommentsData(initial, "v2", "newest")).toBeUndefined();
    expect(initialCommentsData(initial, "v1", "top")).toBeUndefined();
    expect(initialCommentsData(null, "v1", "newest")).toBeUndefined();
  });
});
