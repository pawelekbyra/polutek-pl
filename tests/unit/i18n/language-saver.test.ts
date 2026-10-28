import { describe, expect, it, vi } from "vitest";
import { createLanguageSaver } from "@/lib/i18n/language-saver";
import type { Locale } from "@/lib/i18n/routing";

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe("language saver (S03)", () => {
  it("sends one request at a time and ends on the latest choice (EN then DE)", async () => {
    const pending: Array<{ lang: Locale; d: ReturnType<typeof deferred> }> = [];
    const saver = createLanguageSaver({
      save: (lang) => {
        const d = deferred();
        pending.push({ lang, d });
        return d.promise;
      },
      sleep: async () => undefined,
    });
    saver.reset("pl");
    saver.request("en");
    saver.request("de");
    await tick();
    expect(pending.map((p) => p.lang)).toEqual(["en"]); // DE waits, never overtakes EN
    pending[0]!.d.resolve();
    await tick();
    expect(pending.map((p) => p.lang)).toEqual(["en", "de"]);
    pending[1]!.d.resolve();
    await tick();
    saver.request("de"); // already stored
    await tick();
    expect(pending).toHaveLength(2);
  });

  it("does nothing when the account already has the language", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const saver = createLanguageSaver({ save });
    saver.reset("en");
    saver.request("en");
    await tick();
    expect(save).not.toHaveBeenCalled();
  });

  it("retries a failed save, then reports it once and keeps it pending until flush", async () => {
    const save = vi.fn().mockRejectedValue(new Error("500"));
    const onFailed = vi.fn();
    const onSaved = vi.fn();
    const saver = createLanguageSaver({ save, onFailed, onSaved, retryDelaysMs: [1, 1], sleep: async () => undefined });
    saver.reset("pl");
    saver.request("de");
    await tick();
    expect(save).toHaveBeenCalledTimes(3);
    expect(onFailed).toHaveBeenCalledTimes(1);
    expect(onFailed).toHaveBeenCalledWith("de");

    save.mockResolvedValue(undefined); // connection is back
    saver.flush();
    await tick();
    expect(onSaved).toHaveBeenCalledWith("de");
    expect(save).toHaveBeenCalledTimes(4);
  });

  it("recovers within the retries without reporting", async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error("net")).mockResolvedValue(undefined);
    const onFailed = vi.fn();
    const onSaved = vi.fn();
    const saver = createLanguageSaver({ save, onFailed, onSaved, retryDelaysMs: [1], sleep: async () => undefined });
    saver.reset("pl");
    saver.request("fr");
    await tick();
    expect(onFailed).not.toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalledWith("fr");
  });

  it("a newer choice replaces a failing older one instead of retrying it", async () => {
    const calls: Locale[] = [];
    const saver = createLanguageSaver({
      save: async (lang) => {
        calls.push(lang);
        if (lang === "en") throw new Error("500");
      },
      retryDelaysMs: [5],
      sleep: async () => {
        saver.request("de");
      },
    });
    saver.reset("pl");
    saver.request("en");
    await tick();
    await tick();
    expect(calls).toEqual(["en", "de"]);
  });

  it("reset (another person signs in) drops what was pending and ignores a late answer", async () => {
    const d = deferred();
    const onSaved = vi.fn();
    const saver = createLanguageSaver({ save: () => d.promise, onSaved });
    saver.reset("pl");
    saver.request("en");
    await tick();
    saver.reset("de");
    d.resolve();
    await tick();
    expect(onSaved).not.toHaveBeenCalled();
  });
});
