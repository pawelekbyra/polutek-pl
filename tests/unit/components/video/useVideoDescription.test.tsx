/** @vitest-environment jsdom */

import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicVideoDTO } from "@/app/types/video";
import { __resetVideoDescriptionsForTests, useVideoDescription } from "@/app/components/video/useVideoDescription";

function video(id: string, extra: Partial<PublicVideoDTO> = {}) {
  return { id, slug: id, title: id, ...extra } as PublicVideoDTO;
}

function Probe({ v }: { v: PublicVideoDTO }) {
  const withDescription = useVideoDescription(v);
  return <p data-testid="d">{withDescription.description === undefined ? "pending" : String(withDescription.description)}</p>;
}

describe("useVideoDescription (W03)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    __resetVideoDescriptionsForTests();
    fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ id: "a", description: "Opis A", descriptionEn: null }) }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("does not fetch for a video that already carries its description", () => {
    render(<Probe v={video("a", { description: "Z serwera" })} />);
    expect(screen.getByTestId("d").textContent).toBe("Z serwera");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches the open video description once and fills it in", async () => {
    const { rerender } = render(<Probe v={video("a")} />);
    expect(screen.getByTestId("d").textContent).toBe("pending");
    await act(async () => {});

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toBe("/api/videos/a/description");
    expect(screen.getByTestId("d").textContent).toBe("Opis A");

    // Back to the same video: remembered, no second request.
    rerender(<Probe v={video("a")} />);
    await act(async () => {});
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("stays pending (no crash) when the request fails", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({}) });
    render(<Probe v={video("b")} />);
    await act(async () => {});
    expect(screen.getByTestId("d").textContent).toBe("pending");
  });
});
