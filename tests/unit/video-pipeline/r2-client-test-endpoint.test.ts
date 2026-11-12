import { afterEach, describe, expect, it, vi } from "vitest";
import { makeR2Client } from "@/lib/modules/video-pipeline/infrastructure/r2-storage";

const credentials = { accountId: "test-account", accessKeyId: "test-key", secretAccessKey: "test-secret" };

afterEach(() => vi.unstubAllEnvs());

describe("makeR2Client test endpoint", () => {
  it("allows only HTTP loopback endpoints in the test runtime", () => {
    vi.stubEnv("NODE_ENV", "test");
    const client = makeR2Client(credentials, { testEndpoint: "http://127.0.0.1:43210" });
    client.destroy();

    expect(() => makeR2Client(credentials, { testEndpoint: "http://192.0.2.1:43210" })).toThrow(/loopback HTTP URL/);
    expect(() => makeR2Client(credentials, { testEndpoint: "https://127.0.0.1:43210" })).toThrow(/loopback HTTP URL/);
    expect(() => makeR2Client(credentials, { testEndpoint: "http://127.0.0.1:43210/path" })).toThrow(/loopback HTTP URL/);
  });

  it("refuses test endpoint injection outside NODE_ENV=test", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VIDEO_WORKER_TEST_RUNTIME", "true");
    expect(() => makeR2Client(credentials, { testEndpoint: "http://127.0.0.1:43210" })).toThrow(/test runtime/);
  });

  it("allows the isolated HTTP acceptance runtime while keeping loopback validation", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VIDEO_WORKER_TEST_RUNTIME", "true");
    const client = makeR2Client(credentials, { testEndpoint: "http://127.0.0.1:43210" });
    client.destroy();
    expect(() => makeR2Client(credentials, { testEndpoint: "http://192.0.2.1:43210" })).toThrow(/loopback HTTP URL/);
  });
});
