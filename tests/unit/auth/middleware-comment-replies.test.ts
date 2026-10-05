import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import middleware from "@/middleware";

const ORIGIN = "https://www.pawelperfect.com";
const request = (path: string) =>
  new NextRequest(`${ORIGIN}${path}`, { method: "GET", headers: new Headers({ host: "www.pawelperfect.com" }) });

describe("proxy: comment replies are public reading", () => {
  it("lets a guest (no session cookie) read a thread's replies", async () => {
    const response = await middleware(request("/api/comments/2f0c1e6a-1b2c-4d5e-8f90-123456789abc/replies?limit=20"));
    expect(response.status).toBe(200);
  });

  it("does not open other comment endpoints to guests", async () => {
    expect((await middleware(request("/api/comments/2f0c1e6a-1b2c-4d5e-8f90-123456789abc/context"))).status).toBe(401);
  });
});
