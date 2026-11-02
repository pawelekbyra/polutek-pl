import { describe, it, expect } from "vitest";
import { tidyWrap } from "@/lib/i18n/typography";

const NBSP = " ";

describe("tidyWrap", () => {
  it("glues one- and two-letter words to the next word (Polish)", () => {
    expect(tidyWrap("zgodę na otrzymywanie w domu", "pl")).toBe(`zgodę na${NBSP}otrzymywanie w${NBSP}domu`);
  });
  it("does not glue to very long words (keeps the unbreakable unit narrow)", () => {
    expect(tidyWrap("zu Benachrichtigungsmitteilungen", "de")).toBe("zu Benachrichtigungsmitteilungen");
  });
  it("keeps French punctuation on its line", () => {
    expect(tidyWrap("Voulez-vous vous abonner ?", "fr")).toBe(`Voulez-vous vous abonner${NBSP}?`);
    expect(tidyWrap("Détails : {0} et {1}.", "fr")).toBe(`Détails${NBSP}: {0} et${NBSP}{1}.`);
  });
  it("optionally keeps the last two words together (no widow)", () => {
    expect(tidyWrap("o nowościach mailowych", "pl", { widow: true })).toBe(`o${NBSP}nowościach${NBSP}mailowych`);
    expect(tidyWrap("Subscribing means news.", "en")).toBe("Subscribing means news.");
  });
  it("leaves Chinese untouched (CSS line-break handles it)", () => {
    expect(tidyWrap("订阅即表示您同意。", "zh", { widow: true })).toBe("订阅即表示您同意。");
  });
});
