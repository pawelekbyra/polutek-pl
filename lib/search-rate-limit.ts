import { rateLimit } from "@/lib/rate-limit";

/**
 * One request budget for every way to run a public search: `GET /api/search` and the `/search` page (HTML and
 * Next navigation requests, in any locale). The key does not contain the locale or the path, so switching the
 * language prefix or going through the page instead of the API does not buy extra searches.
 */
export const SEARCH_LIMIT = 60;
export const SEARCH_WINDOW_MS = 60 * 1000;

/** Counts one search for this client address. `ip` comes from the trusted helper (`getClientIp`). */
export async function takeSearchBudget(ip: string): Promise<{ success: boolean }> {
  const result = await rateLimit({ key: `search:${ip}`, limit: SEARCH_LIMIT, windowMs: SEARCH_WINDOW_MS });
  return { success: result.success };
}
