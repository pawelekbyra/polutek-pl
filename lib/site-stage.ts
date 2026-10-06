/**
 * Pre-launch switch: while the site is in its test (beta) stage it shows a small notice, is marked
 * noindex (meta robots + X-Robots-Tag header) and uses a neutral description instead of the hero
 * video's title.
 *
 * ONE place decides: `NEXT_PUBLIC_SITE_BETA`. Default TRUE (beta). At launch set
 * `NEXT_PUBLIC_SITE_BETA=false` in deploy/serwerek `build.env` and rebuild the image: it is a
 * BUILD-TIME variable (inlined into the client bundle and read by next.config.mjs when the routes
 * manifest is built), so changing it on a running container has no effect.
 * next.config.mjs repeats the same rule in plain JS (it cannot import TypeScript); a unit test keeps
 * the two in sync.
 */

const FALSE_VALUES = new Set(["false", "0", "no", "off"]);

/** True unless the value explicitly says "false" (beta is the safe default). */
export function parseBetaFlag(raw: string | undefined): boolean {
  if (raw === undefined) return true;
  return !FALSE_VALUES.has(raw.trim().toLowerCase());
}

// The literal `process.env.NEXT_PUBLIC_SITE_BETA` is required for Next to inline it in client code.
export const SITE_IS_BETA: boolean = parseBetaFlag(process.env.NEXT_PUBLIC_SITE_BETA);
