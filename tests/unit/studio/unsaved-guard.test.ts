import { afterEach, describe, expect, it, vi } from "vitest";
import { confirmLeave, hasUnsavedWork, setUnsavedWork } from "@/app/components/studio/unsaved-guard";

describe("unsaved work guard", () => {
  afterEach(() => {
    setUnsavedWork(false);
    vi.unstubAllGlobals();
  });

  it("lets the user leave when nothing is unsaved, without asking", () => {
    const confirm = vi.fn();
    vi.stubGlobal("window", { confirm, addEventListener: vi.fn(), removeEventListener: vi.fn() });
    expect(confirmLeave("sure?")).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });

  it("asks while work is unsaved and follows the answer", () => {
    const confirm = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);
    vi.stubGlobal("window", { confirm, addEventListener: vi.fn(), removeEventListener: vi.fn() });
    setUnsavedWork(true);
    expect(hasUnsavedWork()).toBe(true);
    expect(confirmLeave("sure?")).toBe(false);
    expect(confirmLeave("sure?")).toBe(true);
    expect(confirm).toHaveBeenCalledWith("sure?");
  });

  it("registers beforeunload only while something is unsaved", () => {
    const add = vi.fn();
    const remove = vi.fn();
    vi.stubGlobal("window", { confirm: vi.fn(), addEventListener: add, removeEventListener: remove });
    setUnsavedWork(true);
    setUnsavedWork(true);
    expect(add).toHaveBeenCalledTimes(1);
    expect(add.mock.calls[0][0]).toBe("beforeunload");
    setUnsavedWork(false);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(hasUnsavedWork()).toBe(false);
  });
});
