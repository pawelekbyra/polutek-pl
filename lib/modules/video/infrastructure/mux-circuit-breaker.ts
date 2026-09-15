import { rateLimit, setNxEx, peek } from "@/lib/rate-limit";
import { recordAlert, notifyAlertWebhook } from "@/lib/observability";
import { createScopedLogger } from "@/lib/logger";

const logger = createScopedLogger("MuxCircuitBreaker");

const GLOBAL_PLAYBACK_EVENT_KEY = "mux:global-playback-events";
const DEGRADED_FLAG_KEY = "mux:degraded";
const ONE_HOUR_MS = 60 * 60 * 1000;

function getSoftLimit(): number {
  const raw = Number(process.env.MUX_GLOBAL_SOFT_LIMIT_PER_HOUR);
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
}

/**
 * Global (not per-user, not per-IP) counter of Mux playback events in the current rolling hour.
 * Reuses the same rate-limit store as everything else in lib/rate-limit.ts — a single fixed key
 * means every request across every user shares one counter/window, exactly the "how much Mux
 * traffic is the whole site generating right now" signal the circuit breaker needs.
 *
 * Disabled (zero overhead, no Redis round-trip at all) unless MUX_GLOBAL_SOFT_LIMIT_PER_HOUR is
 * configured — this must never affect normal traffic when the feature isn't opted into.
 *
 * Fire-and-forget from the caller's perspective: swallows its own errors so a Redis hiccup can
 * never block or fail a playback event.
 */
export async function recordGlobalMuxPlaybackEvent(): Promise<void> {
  const softLimit = getSoftLimit();
  if (softLimit <= 0) return;

  try {
    const result = await rateLimit({ key: GLOBAL_PLAYBACK_EVENT_KEY, limit: softLimit, windowMs: ONE_HOUR_MS });
    if (result.success) return;

    // Just crossed (or is still over) the threshold. setNxEx is a no-op if another concurrent
    // request already flipped the flag this window, so we only alert once per trip.
    const justTripped = await setNxEx(DEGRADED_FLAG_KEY, "1", Math.ceil(ONE_HOUR_MS / 1000));
    if (!justTripped) return;

    const fields = { softLimitPerHour: softLimit };
    recordAlert("mux.circuit_breaker.tripped", fields);
    await notifyAlertWebhook(
      "Mux delivery circuit breaker tripped",
      `Global Mux playback events exceeded ${softLimit}/hour. Delivery resolution is now degraded site-wide until the window resets.`,
      fields,
    );
  } catch (error) {
    logger.warn("Failed to record global Mux playback event (best-effort, ignoring)", error);
  }
}

/**
 * Whether the global circuit breaker is currently tripped. Read-only — never increments the
 * counter above. Disabled (always false, no Redis round-trip) unless
 * MUX_GLOBAL_SOFT_LIMIT_PER_HOUR is configured, and fails open (returns false) on any error, since
 * an infra hiccup here must degrade to "normal behavior", never to "degrade everyone by mistake".
 */
export async function isMuxDeliveryDegraded(): Promise<boolean> {
  if (getSoftLimit() <= 0) return false;

  try {
    return Boolean(await peek(DEGRADED_FLAG_KEY));
  } catch (error) {
    logger.warn("Failed to read Mux circuit breaker flag (failing open / not degraded)", error);
    return false;
  }
}
