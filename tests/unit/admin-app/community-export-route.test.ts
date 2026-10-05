import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  exportUsersCsv: vi.fn(),
  guard: { hasFreshStepUp: vi.fn(async () => true), requireAdmin: vi.fn() },
  api: { adminFromRequest: vi.fn(async () => ({ userId: "adm1" })) },
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/modules/admin-community", () => ({ exportUsersCsv: m.exportUsersCsv, USER_SEGMENTS: ["nowi", "wspierajacy"] }));
vi.mock("@admin/lib/auth/guard", () => m.guard);
vi.mock("@admin/lib/auth/api-guard", () => m.api);

import { POST } from "@admin/app/api/spolecznosc/uzytkownicy/export/route";
import { resetRateLimits } from "@admin/lib/actions/rate-limit";

const req = (body: unknown) => new Request("https://admin.test/api/spolecznosc/uzytkownicy/export", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimits();
  m.guard.hasFreshStepUp.mockResolvedValue(true);
  m.api.adminFromRequest.mockResolvedValue({ userId: "adm1" });
  m.exportUsersCsv.mockResolvedValue({ ok: true, data: { csv: "﻿\"A\"\r\n", rows: 1, fileName: "uzytkownicy-2026-10-05.csv" } });
});

describe("POST users export", () => {
  it("401 without a panel session, nothing exported", async () => {
    m.api.adminFromRequest.mockResolvedValue(null as never);
    expect((await POST(req({}))).status).toBe(401);
    expect(m.exportUsersCsv).not.toHaveBeenCalled();
  });
  it("403 STEP_UP_REQUIRED without a fresh step-up, nothing exported", async () => {
    m.guard.hasFreshStepUp.mockResolvedValue(false);
    const res = await POST(req({}));
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: "STEP_UP_REQUIRED" });
    expect(m.exportUsersCsv).not.toHaveBeenCalled();
  });
  it("400 for unknown fields or segments", async () => {
    expect((await POST(req({ seg: "wszyscy" }))).status).toBe(400);
    expect((await POST(req({ evil: 1 }))).status).toBe(400);
    expect(m.exportUsersCsv).not.toHaveBeenCalled();
  });
  it("returns the file as an attachment, never cached, with the filters passed on", async () => {
    const res = await POST(req({ q: " ola ", seg: "nowi" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("content-disposition")).toContain("attachment");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(m.exportUsersCsv).toHaveBeenCalledWith(expect.anything(), { q: "ola", seg: "nowi" });
  });
  it("429 after 5 exports in an hour; use-case refusals keep their status", async () => {
    for (let i = 0; i < 5; i++) await POST(req({}));
    expect((await POST(req({}))).status).toBe(429);
    resetRateLimits();
    m.exportUsersCsv.mockResolvedValue({ ok: false, error: { statusCode: 413, message: "Za dużo wierszy (30000). Zawęź filtry." } });
    const res = await POST(req({}));
    expect(res.status).toBe(413);
    expect((await res.json()).error).toContain("Za dużo wierszy");
  });
});
