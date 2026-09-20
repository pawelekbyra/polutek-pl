import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const mockRateLimit = vi.fn();
const mockSetNxEx = vi.fn();
const mockPeek = vi.fn();
const mockRecordAlert = vi.fn();
const mockNotifyAlertWebhook = vi.fn();

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: mockRateLimit,
  setNxEx: mockSetNxEx,
  peek: mockPeek,
}));

vi.mock("@/lib/observability", () => ({
  recordAlert: mockRecordAlert,
  notifyAlertWebhook: mockNotifyAlertWebhook,
}));

describe("Mux circuit breaker", () => {
  const originalSoftLimit = process.env.MUX_GLOBAL_SOFT_LIMIT_PER_HOUR;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.MUX_GLOBAL_SOFT_LIMIT_PER_HOUR;
  });

  afterEach(() => {
    if (originalSoftLimit === undefined) delete process.env.MUX_GLOBAL_SOFT_LIMIT_PER_HOUR;
    else process.env.MUX_GLOBAL_SOFT_LIMIT_PER_HOUR = originalSoftLimit;
  });

  describe("recordGlobalMuxPlaybackEvent", () => {
    it("is a complete no-op (never touches the rate-limit store) when the soft limit isn't configured", async () => {
      const { recordGlobalMuxPlaybackEvent } = await import("@/lib/modules/video/infrastructure/mux-circuit-breaker");
      await recordGlobalMuxPlaybackEvent();
      expect(mockRateLimit).not.toHaveBeenCalled();
    });

    it("does nothing when under the configured threshold", async () => {
      process.env.MUX_GLOBAL_SOFT_LIMIT_PER_HOUR = "1000";
      mockRateLimit.mockResolvedValue({ success: true, remaining: 500 });

      const { recordGlobalMuxPlaybackEvent } = await import("@/lib/modules/video/infrastructure/mux-circuit-breaker");
      await recordGlobalMuxPlaybackEvent();

      expect(mockRateLimit).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 1000, windowMs: 60 * 60 * 1000 }),
      );
      expect(mockSetNxEx).not.toHaveBeenCalled();
      expect(mockRecordAlert).not.toHaveBeenCalled();
    });

    it("trips the breaker and alerts exactly once when the threshold is first exceeded", async () => {
      process.env.MUX_GLOBAL_SOFT_LIMIT_PER_HOUR = "1000";
      mockRateLimit.mockResolvedValue({ success: false, remaining: 0 });
      mockSetNxEx.mockResolvedValue(true); // flag was newly set

      const { recordGlobalMuxPlaybackEvent } = await import("@/lib/modules/video/infrastructure/mux-circuit-breaker");
      await recordGlobalMuxPlaybackEvent();

      expect(mockRecordAlert).toHaveBeenCalledWith("mux.circuit_breaker.tripped", expect.objectContaining({ softLimitPerHour: 1000 }));
      expect(mockNotifyAlertWebhook).toHaveBeenCalledTimes(1);
    });

    it("does not re-alert on subsequent calls while already tripped this window", async () => {
      process.env.MUX_GLOBAL_SOFT_LIMIT_PER_HOUR = "1000";
      mockRateLimit.mockResolvedValue({ success: false, remaining: 0 });
      mockSetNxEx.mockResolvedValue(false); // flag already set by an earlier call

      const { recordGlobalMuxPlaybackEvent } = await import("@/lib/modules/video/infrastructure/mux-circuit-breaker");
      await recordGlobalMuxPlaybackEvent();

      expect(mockRecordAlert).not.toHaveBeenCalled();
      expect(mockNotifyAlertWebhook).not.toHaveBeenCalled();
    });

    it("swallows store errors instead of throwing (best-effort)", async () => {
      process.env.MUX_GLOBAL_SOFT_LIMIT_PER_HOUR = "1000";
      mockRateLimit.mockRejectedValue(new Error("redis unavailable"));

      const { recordGlobalMuxPlaybackEvent } = await import("@/lib/modules/video/infrastructure/mux-circuit-breaker");
      await expect(recordGlobalMuxPlaybackEvent()).resolves.toBeUndefined();
    });
  });

  describe("isMuxDeliveryDegraded", () => {
    it("returns false without reading the store when the soft limit isn't configured", async () => {
      const { isMuxDeliveryDegraded } = await import("@/lib/modules/video/infrastructure/mux-circuit-breaker");
      expect(await isMuxDeliveryDegraded()).toBe(false);
      expect(mockPeek).not.toHaveBeenCalled();
    });

    it("returns true when the degraded flag is set", async () => {
      process.env.MUX_GLOBAL_SOFT_LIMIT_PER_HOUR = "1000";
      mockPeek.mockResolvedValue("1");

      const { isMuxDeliveryDegraded } = await import("@/lib/modules/video/infrastructure/mux-circuit-breaker");
      expect(await isMuxDeliveryDegraded()).toBe(true);
    });

    it("returns false when the degraded flag is absent", async () => {
      process.env.MUX_GLOBAL_SOFT_LIMIT_PER_HOUR = "1000";
      mockPeek.mockResolvedValue(null);

      const { isMuxDeliveryDegraded } = await import("@/lib/modules/video/infrastructure/mux-circuit-breaker");
      expect(await isMuxDeliveryDegraded()).toBe(false);
    });

    it("fails open (false) on a store error rather than degrading everyone by mistake", async () => {
      process.env.MUX_GLOBAL_SOFT_LIMIT_PER_HOUR = "1000";
      mockPeek.mockRejectedValue(new Error("redis unavailable"));

      const { isMuxDeliveryDegraded } = await import("@/lib/modules/video/infrastructure/mux-circuit-breaker");
      expect(await isMuxDeliveryDegraded()).toBe(false);
    });
  });
});
