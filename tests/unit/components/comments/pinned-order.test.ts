import { describe, expect, it } from "vitest";
import { insertBelowPinned, pinnedFirst } from "@/app/components/comments/hooks/pinned-order";
import type { CommentView } from "@/app/components/comments/types";

const c = (id: string, isPinned = false) => ({ id, isPinned }) as unknown as CommentView;
const ids = (list: CommentView[]) => list.map((x) => x.id);

describe("pinned comment order", () => {
  it("puts a new comment below the pinned one, never above it", () => {
    expect(ids(insertBelowPinned([c("pin", true), c("a"), c("b")], c("new")))).toEqual(["pin", "new", "a", "b"]);
  });

  it("puts a new comment first when nothing is pinned, and last in a list that is all pinned", () => {
    expect(ids(insertBelowPinned([c("a"), c("b")], c("new")))).toEqual(["new", "a", "b"]);
    expect(ids(insertBelowPinned([c("pin", true)], c("new")))).toEqual(["pin", "new"]);
    expect(ids(insertBelowPinned([], c("new")))).toEqual(["new"]);
  });

  it("moves a freshly pinned comment to the top and keeps the rest in order", () => {
    expect(ids(pinnedFirst([c("a"), c("b", true), c("d")]))).toEqual(["b", "a", "d"]);
  });
});
