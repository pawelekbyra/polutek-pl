import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  language: "pl" as "pl" | "en",
  redirect: vi.fn((target: string) => {
    throw new Error(`REDIRECT ${target}`);
  }),
}));

vi.mock("next/navigation", () => ({ redirect: h.redirect }));
vi.mock("@/lib/i18n/server-language", () => ({ resolveInitialLanguage: async () => h.language }));

import RootRedirect from "@/app/page";
import LegacyWatchRedirect from "@/app/watch/[slug]/page";
import LegacyChannelRedirect from "@/app/channel/[slug]/page";
import LegacySearchRedirect from "@/app/search/page";
import RedirectTerms from "@/app/regulamin/page";
import RedirectPrivacy from "@/app/polityka-prywatnosci/page";

async function target(render: () => Promise<unknown>): Promise<string> {
  await expect(render()).rejects.toThrow(/^REDIRECT /);
  return String(h.redirect.mock.calls.at(-1)![0]);
}

const params = (slug: string) => Promise.resolve({ slug });
const query = (q: Record<string, string>) => Promise.resolve(q);

describe("bare-path fallback pages never redirect back to a bare path (no loop)", () => {
  beforeEach(() => {
    h.redirect.mockClear();
  });

  it.each(["pl", "en"] as const)("the root page sends a %s viewer to the explicit locale", async (language) => {
    h.language = language;
    expect(await target(() => RootRedirect())).toBe(`/${language}`);
  });

  it("every legacy page names its locale in the target", async () => {
    h.language = "pl";
    expect(await target(() => LegacyWatchRedirect({ params: params("film"), searchParams: query({ t: "1" }) }))).toBe("/pl/watch/film?t=1");
    expect(await target(() => LegacyChannelRedirect({ params: params("main"), searchParams: query({}) }))).toBe("/pl/channel/main");
    expect(await target(() => LegacySearchRedirect({ searchParams: query({ q: "kot" }) }))).toBe("/pl/search?q=kot");
    expect(await target(() => RedirectTerms())).toBe("/pl/regulamin");
    expect(await target(() => RedirectPrivacy())).toBe("/pl/polityka-prywatnosci");
    h.language = "en";
    expect(await target(() => RedirectTerms())).toBe("/en/terms");
    expect(await target(() => LegacyWatchRedirect({ params: params("film"), searchParams: query({}) }))).toBe("/en/watch/film");
  });
});
