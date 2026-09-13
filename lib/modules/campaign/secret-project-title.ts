/**
 * Shared title-highlighting helper for /secretproject and /secretproject2.
 *
 * Both pages independently render the same `PROJECT_TITLE` copy with the word
 * "secret" re-styled inline (a different color/underline per page). Each used
 * to do its own `PROJECT_TITLE.split(" secret ")[0]` / `[1]` — if the two
 * separately-maintained title constants (see CLAUDE.md's note on
 * /secretproject vs /secretproject2) ever drift apart, a raw `.split(...)[1]`
 * silently returns `undefined` for a title that no longer contains the exact
 * " secret " substring, and the second half of the heading silently renders
 * nothing with no compile-time or runtime signal.
 *
 * This file is imported by "use client" components, so it must stay a plain,
 * dependency-free pure function — no server-only imports (prisma, Clerk
 * server APIs) like `secret-project-funding.ts` in this same directory has.
 */

export interface HighlightedTitleParts {
  /** Text before the highlighted word (or the entire title on a no-match fallback). */
  before: string;
  /** The highlighted word itself, empty when not found. */
  highlight: string;
  /** Text after the highlighted word, empty when not found. */
  after: string;
  /** Whether `highlightWord` was actually found in `title`. */
  matched: boolean;
}

/**
 * Splits `title` around a single occurrence of `highlightWord` (matched as a
 * whole, space-delimited word — e.g. "secret" inside "... my secret project")
 * so callers can render `before + <styled>highlight</styled> + after`.
 *
 * Defensive by design: if `highlightWord` isn't found as a space-delimited
 * word in `title` (e.g. the two title constants fell out of sync), returns
 * `matched: false` with the whole title in `before` and empty `highlight`/
 * `after` — callers should render the plain title unstyled in that case
 * rather than dropping the un-matched half of the heading.
 */
export function splitTitleForHighlight(title: string, highlightWord: string): HighlightedTitleParts {
  const needle = ` ${highlightWord} `;
  const index = title.indexOf(needle);

  if (index === -1) {
    return { before: title, highlight: "", after: "", matched: false };
  }

  return {
    before: title.slice(0, index),
    highlight: highlightWord,
    after: title.slice(index + needle.length),
    matched: true,
  };
}
