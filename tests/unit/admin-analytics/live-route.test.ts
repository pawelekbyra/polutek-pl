import { beforeEach, describe, expect, it, vi } from "vitest";
import { createLiveHub } from "@/lib/modules/admin-analytics";

const state = vi.hoisted(() => ({ admin: true as boolean, hub: null as unknown }));

vi.mock("@admin/lib/auth/api-guard", () => ({
  adminFromRequest: async () => (state.admin ? { userId: "u" } : null),
  unauthorized: () => Response.json({ error: "Unauthorized" }, { status: 401 }),
}));
vi.mock("@admin/lib/api/panel-route", () => ({ jsonError: (status: number, error: string, code?: string) => Response.json({ error, code }, { status }) }));
vi.mock("@admin/lib/live-hubs", () => ({ liveHubFor: () => state.hub }));

import { GET } from "@admin/app/api/live/route";

const req = (qs = "", signal?: AbortSignal) => new Request(`https://admin.example/api/live${qs}`, { signal });

beforeEach(() => {
  state.admin = true;
  state.hub = createLiveHub({ poll: async () => ({ ok: 1 }), intervalMs: 3000, maxSubscribers: 2 });
});

describe("GET /api/live", () => {
  it("needs an admin session", async () => {
    state.admin = false;
    expect((await GET(req())).status).toBe(401);
  });

  it("rejects a malformed film key", async () => {
    expect((await GET(req("?video=../etc"))).status).toBe(400);
  });

  it("answers 503 when no more live views are allowed", async () => {
    state.hub = null;
    expect((await GET(req())).status).toBe(503);
  });

  it("streams text/event-stream that no proxy may buffer, and closes with the request", async () => {
    const ac = new AbortController();
    const res = await GET(req("?video=czesc", ac.signal));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    expect(res.headers.get("cache-control")).toBe("private, no-store, no-transform");
    expect(res.headers.get("x-accel-buffering")).toBe("no");
    const reader = res.body!.getReader();
    const first = new TextDecoder().decode((await reader.read()).value);
    expect(first).toBe("retry: 5000\n\n");
    ac.abort();
    let done = false;
    for (let i = 0; i < 10 && !done; i++) done = (await reader.read()).done;
    expect(done).toBe(true);
    expect((state.hub as { subscribers(): number }).subscribers()).toBe(0);
  });
});
