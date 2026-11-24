import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  resolveStudioSession: vi.fn(),
  setChannelBanner: vi.fn(),
}));

vi.mock("@/lib/api/studio-session", () => ({ resolveStudioSession: m.resolveStudioSession }));
vi.mock("@/lib/modules/channel", () => ({ setChannelBanner: m.setChannelBanner }));

import { PUT as bannerPut } from "@/app/api/studio/channel/banner/route";
import { CHANNEL_BANNER_BODY_MAX_BYTES, CHANNEL_BANNER_DATA_URL_SCHEMA_MAX } from "@/lib/api/studio-schemas";
import { BANNER_MAX_DATA_URL_CHARS } from "@/lib/modules/channel/domain/channel-banner-limits";

const channel = { id: "ch-1", slug: "moj", handle: "moj", name: "Mój", status: "ACTIVE", isVerified: false, language: "pl", country: null };
const session = { ctx: { actor: { type: "user", userId: "u1" }, channelId: "ch-1" }, userId: "u1", channel, channels: [channel] };

const PREFIX = "data:image/jpeg;base64,";
const dataUrlOfLength = (chars: number) => PREFIX + "A".repeat(chars - PREFIX.length);

function bannerRequest(body: string) {
  return new Request("https://www.pawelperfect.com/api/studio/channel/banner", {
    method: "PUT",
    headers: { "content-type": "application/json", "content-length": String(new TextEncoder().encode(body).byteLength) },
    body,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  m.resolveStudioSession.mockResolvedValue(session);
  m.setChannelBanner.mockResolvedValue({ ok: true, data: { bannerUrl: "/api/channel-banners/ch-1?v=1" } });
});

describe("PUT /api/studio/channel/banner body cap (audit U1)", () => {
  it("fits the largest data URL the schema and the domain allow, with room for the JSON wrapper", () => {
    expect(CHANNEL_BANNER_DATA_URL_SCHEMA_MAX).toBeGreaterThanOrEqual(BANNER_MAX_DATA_URL_CHARS);
    const largest = JSON.stringify({ dataUrl: dataUrlOfLength(CHANNEL_BANNER_DATA_URL_SCHEMA_MAX) });
    expect(new TextEncoder().encode(largest).byteLength).toBeLessThan(CHANNEL_BANNER_BODY_MAX_BYTES);
  });

  it("accepts a banner of the maximum allowed length (400 000 characters) and hands it to the use case", async () => {
    const dataUrl = dataUrlOfLength(BANNER_MAX_DATA_URL_CHARS);
    const response = await bannerPut(bannerRequest(JSON.stringify({ dataUrl })));
    expect(response.status).toBe(200);
    expect(m.setChannelBanner).toHaveBeenCalledTimes(1);
    expect(m.setChannelBanner.mock.calls[0][1]).toEqual({ dataUrl });
  });

  it("still lets a schema-maximum data URL through to the use case (which then rejects it with its own message)", async () => {
    const response = await bannerPut(bannerRequest(JSON.stringify({ dataUrl: dataUrlOfLength(CHANNEL_BANNER_DATA_URL_SCHEMA_MAX) })));
    expect(response.status).toBe(200);
    expect(m.setChannelBanner).toHaveBeenCalledTimes(1);
  });

  it("answers 413 with a readable message naming the limit for a larger body, before the use case runs", async () => {
    const response = await bannerPut(bannerRequest(JSON.stringify({ dataUrl: dataUrlOfLength(CHANNEL_BANNER_BODY_MAX_BYTES + 1) })));
    expect(response.status).toBe(413);
    const body = await response.json();
    expect(body.code).toBe("PAYLOAD_TOO_LARGE");
    expect(body.error).toBe("Żądanie jest za duże (limit 640 KB).");
    expect(m.setChannelBanner).not.toHaveBeenCalled();
  });

  it("answers 413 for a larger body that does not declare its length (the streamed bytes are counted)", async () => {
    const body = JSON.stringify({ dataUrl: dataUrlOfLength(CHANNEL_BANNER_BODY_MAX_BYTES + 1) });
    const request = new Request("https://www.pawelperfect.com/api/studio/channel/banner", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: new Blob([body]).stream(),
      duplex: "half",
    } as RequestInit & { duplex: "half" });
    const response = await bannerPut(request);
    expect(response.status).toBe(413);
    expect(m.setChannelBanner).not.toHaveBeenCalled();
  });
});
