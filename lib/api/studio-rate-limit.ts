import { rateLimit } from "@/lib/rate-limit";
import { studioError } from "./studio-route";

/**
 * Per-user budget for Studio calls that are cheap to repeat (playlists): `limit` calls per `windowMs`, counted per
 * bucket. Returns the 429 response when the budget is spent, otherwise null. A store outage does not block creators.
 */
export async function enforceStudioRateLimit(userId: string, bucket: string, limit: number, windowMs = 60_000): Promise<Response | null> {
  try {
    const result = await rateLimit({ key: `studio:${bucket}:${userId}`, limit, windowMs });
    if (!result.success) return studioError(429, "Zbyt wiele żądań. Spróbuj ponownie za chwilę.", "RATE_LIMITED");
  } catch {
    return null;
  }
  return null;
}
