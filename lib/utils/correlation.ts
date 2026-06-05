import { headers } from "next/headers";

/**
 * Returns the correlation ID for the current request.
 * Should be used in Server Components, Actions, and Route Handlers.
 */
export function getCorrelationId(): string | null {
  try {
    const h = headers();
    return h.get("x-request-id");
  } catch {
    // headers() might throw if called outside of request context (e.g. build time or some edge cases)
    return null;
  }
}
