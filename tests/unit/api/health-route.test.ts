import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { checkHealth, getActorFromAuth, createAppContext } = vi.hoisted(() => ({
  checkHealth: vi.fn(),
  getActorFromAuth: vi.fn(),
  createAppContext: vi.fn(),
}));

vi.mock("@/lib/modules/health", () => ({ checkHealth }));
vi.mock("@/lib/api/auth", () => ({ getActorFromAuth }));
vi.mock("@/lib/modules/shared/app-context", () => ({ createAppContext }));

import { GET } from "@/app/api/health/route";

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getActorFromAuth.mockResolvedValue({ type: "guest" });
    createAppContext.mockReturnValue({});
  });

  it("keeps the public unauthenticated check as liveness", async () => {
    checkHealth.mockResolvedValue({ ok: true });

    const response = await GET(new NextRequest("http://localhost/api/health"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(checkHealth).toHaveBeenCalledWith({}, null);
  });

  it("returns 503 when the authorized readiness check detects a failed dependency", async () => {
    checkHealth.mockResolvedValue({ ok: false, database: "failed" });

    const response = await GET(new NextRequest("http://localhost/api/health", {
      headers: { "x-health-token": "diagnostic-secret" },
    }));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, database: "failed" });
  });

  it("returns 200 when the authorized readiness check passes", async () => {
    checkHealth.mockResolvedValue({ ok: true, database: "ok" });

    const response = await GET(new NextRequest("http://localhost/api/health", {
      headers: { "x-health-token": "diagnostic-secret" },
    }));

    expect(response.status).toBe(200);
  });
});
