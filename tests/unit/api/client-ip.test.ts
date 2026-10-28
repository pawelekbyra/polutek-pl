import { afterEach, describe, expect, it, vi } from "vitest";
import { getClientIp, isCfConnectingIpTrusted } from "@/lib/api/client-ip";
import { getMediaClientIp } from "@/lib/media/rate-limit";
import { NextRequest } from "next/server";

afterEach(() => vi.unstubAllEnvs());

describe("getClientIp", () => {
  it("default: last x-forwarded-for hop, then x-real-ip, then unknown", () => {
    expect(getClientIp(new Headers({ "x-forwarded-for": "9.9.9.9, 4.4.4.4" }))).toBe("4.4.4.4");
    expect(getClientIp(new Headers({ "x-real-ip": "5.5.5.5" }))).toBe("5.5.5.5");
    expect(getClientIp(new Headers())).toBe("unknown");
  });

  it("ignores CF-Connecting-IP unless TRUST_CF_CONNECTING_IP=true", () => {
    const h = new Headers({ "cf-connecting-ip": "1.2.3.4", "x-forwarded-for": "9.9.9.9, 4.4.4.4" });
    expect(isCfConnectingIpTrusted()).toBe(false);
    expect(getClientIp(h)).toBe("4.4.4.4");
    vi.stubEnv("TRUST_CF_CONNECTING_IP", "false");
    expect(getClientIp(h)).toBe("4.4.4.4");
  });

  it("uses CF-Connecting-IP when trusted", () => {
    vi.stubEnv("TRUST_CF_CONNECTING_IP", "true");
    const h = new Headers({ "cf-connecting-ip": " 2001:db8::1 ", "x-forwarded-for": "9.9.9.9, 4.4.4.4" });
    expect(isCfConnectingIpTrusted()).toBe(true);
    expect(getClientIp(h)).toBe("2001:db8::1");
  });

  it("falls back to the legacy chain when trusted but the header is missing or malformed", () => {
    vi.stubEnv("TRUST_CF_CONNECTING_IP", "TRUE");
    expect(getClientIp(new Headers({ "x-forwarded-for": "9.9.9.9, 4.4.4.4" }))).toBe("4.4.4.4");
    expect(getClientIp(new Headers({ "cf-connecting-ip": "1.1.1.1, 2.2.2.2", "x-real-ip": "5.5.5.5" }))).toBe("5.5.5.5");
    expect(getClientIp(new Headers({ "cf-connecting-ip": "x".repeat(200) }))).toBe("unknown");
  });

  it("is what the media helper uses", () => {
    vi.stubEnv("TRUST_CF_CONNECTING_IP", "true");
    const headers = { "cf-connecting-ip": "7.7.7.7", "x-forwarded-for": "9.9.9.9, 4.4.4.4" };
    expect(getClientIp(new Headers(headers))).toBe("7.7.7.7");
    expect(getMediaClientIp(new NextRequest("http://localhost/api/x", { headers }))).toBe("7.7.7.7");
  });
});
