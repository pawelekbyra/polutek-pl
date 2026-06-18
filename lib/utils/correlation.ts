import { headers } from "next/headers";

type SynchronousHeaders = Awaited<ReturnType<typeof headers>>;

/** Returns the correlation ID for the current request. */
export function getCorrelationId(): string | null {
  try {
    const requestHeaders = headers() as unknown as SynchronousHeaders;
    return requestHeaders.get("x-request-id");
  } catch {
    return null;
  }
}
