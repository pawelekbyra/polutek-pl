import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

import { config } from "@/middleware";

// Compile config.matcher with the same function `next build` uses, so the test sees exactly the
// regexes the deployed proxy runs. The module ships without type declarations.
const require = createRequire(import.meta.url);
const { getMiddlewareMatchers } = require("next/dist/build/analysis/get-page-static-info") as {
  getMiddlewareMatchers: (matcher: string[], nextConfig: Record<string, unknown>) => { regexp: string }[];
};

const regexes = getMiddlewareMatchers(config.matcher, {}).map(({ regexp }) => new RegExp(regexp));
const runsProxy = (path: string) => regexes.some((regex) => regex.test(path));

describe("proxy matcher", () => {
  // Regression 2026-10-20: the static-file lookahead was written with `\.` in a plain string (i.e. `.`),
  // so any path containing "js", "css", "png", ... somewhere skipped the proxy (no /pl rewrite, no session gate, no CSP).
  it.each(["/", "/wejsciowka", "/abcjsdef", "/projects", "/watch/png-tutorial", "/@kowalski", "/studio", "/pl/watch/css-basics", "/manifest.json", "/api/user/profile", "/api/videos/a.png/thumbnail"])(
    "runs the proxy for %s",
    (path) => {
      expect(runsProxy(path)).toBe(true);
    },
  );

  it.each(["/x.js", "/a.css", "/favicon.ico", "/logo.png", "/photo.jpeg", "/site.webmanifest", "/subtitles/en.vtt", "/_next/static/chunks/main.js", "/_next/image"])(
    "skips static file %s",
    (path) => {
      expect(runsProxy(path)).toBe(false);
    },
  );

  it("keeps the extension dot escaped in the source", () => {
    expect(config.matcher[0]).toContain("[^?]*\\.(?:");
  });
});
