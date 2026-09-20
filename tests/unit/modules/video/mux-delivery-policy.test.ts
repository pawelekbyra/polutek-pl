import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { resolveMuxMaxResolution, MUX_VIDEO_QUALITY } from "@/lib/modules/video/domain/mux-delivery.policy";

const ENV_KEYS = ["MUX_MAX_RESOLUTION", "MUX_MAX_RESOLUTION_ANONYMOUS", "MUX_DEGRADED_MAX_RESOLUTION"] as const;

describe("resolveMuxMaxResolution", () => {
  const originalEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      originalEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  });

  it("defaults to 1080p for signed-in viewers with no env configured", () => {
    expect(resolveMuxMaxResolution({ isAnonymous: false, degraded: false })).toBe("1080p");
  });

  it("defaults to 720p for anonymous viewers with no env configured", () => {
    expect(resolveMuxMaxResolution({ isAnonymous: true, degraded: false })).toBe("720p");
  });

  it("honors MUX_MAX_RESOLUTION for signed-in viewers", () => {
    process.env.MUX_MAX_RESOLUTION = "1440p";
    expect(resolveMuxMaxResolution({ isAnonymous: false, degraded: false })).toBe("1440p");
  });

  it("honors MUX_MAX_RESOLUTION_ANONYMOUS for anonymous viewers", () => {
    process.env.MUX_MAX_RESOLUTION_ANONYMOUS = "480p";
    expect(resolveMuxMaxResolution({ isAnonymous: true, degraded: false })).toBe("480p");
  });

  it("never lets the anonymous cap exceed the signed-in cap even if misconfigured", () => {
    process.env.MUX_MAX_RESOLUTION = "720p";
    process.env.MUX_MAX_RESOLUTION_ANONYMOUS = "2160p"; // misconfigured higher than the default
    expect(resolveMuxMaxResolution({ isAnonymous: true, degraded: false })).toBe("720p");
  });

  it("falls back to the default for an invalid env value instead of crashing", () => {
    process.env.MUX_MAX_RESOLUTION = "not-a-real-resolution";
    expect(resolveMuxMaxResolution({ isAnonymous: false, degraded: false })).toBe("1080p");
  });

  it("clamps down to MUX_DEGRADED_MAX_RESOLUTION when the circuit breaker is tripped", () => {
    expect(resolveMuxMaxResolution({ isAnonymous: false, degraded: true })).toBe("480p");
  });

  it("degraded cap never raises resolution above what the viewer's tier already had", () => {
    process.env.MUX_MAX_RESOLUTION_ANONYMOUS = "360p";
    process.env.MUX_DEGRADED_MAX_RESOLUTION = "1080p"; // misconfigured — degrade must never mean "upgrade"
    expect(resolveMuxMaxResolution({ isAnonymous: true, degraded: true })).toBe("360p");
  });

  it("honors a custom MUX_DEGRADED_MAX_RESOLUTION", () => {
    process.env.MUX_DEGRADED_MAX_RESOLUTION = "360p";
    expect(resolveMuxMaxResolution({ isAnonymous: false, degraded: true })).toBe("360p");
  });
});

describe("MUX_VIDEO_QUALITY", () => {
  it("is the free-to-encode 'basic' tier", () => {
    expect(MUX_VIDEO_QUALITY).toBe("basic");
  });
});
