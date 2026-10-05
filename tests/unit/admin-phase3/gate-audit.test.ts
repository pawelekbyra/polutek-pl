import { beforeEach, describe, expect, it, vi } from "vitest";

const guard = vi.hoisted(() => ({ requireAdmin: vi.fn(async () => ({ userId: "adm1", email: "o@x", name: "O", role: "OWNER", languages: [], sessionCreatedAt: "", stepUpSecondsLeft: 0 })), hasFreshStepUp: vi.fn(async () => true) }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "cf-ray": "ray9", "cf-connecting-ip": "203.0.113.7", "user-agent": "Mozilla/5.0 test" }) }));
vi.mock("@admin/lib/auth/guard", () => guard);

import { openGate } from "@admin/lib/actions/gate";
import { resetRateLimits } from "@admin/lib/actions/rate-limit";
import { recordAuditEvent } from "@/lib/modules/audit";
import { createAppContext } from "@/lib/modules/shared/app-context";

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimits();
  delete process.env.ADMIN_DEV_FIXTURES;
});

describe("openGate", () => {
  const rule = { key: "t", max: 2, windowMs: 60_000 };
  it("requires the owner role by default and passes explicit roles on", async () => {
    await openGate({ path: "/x", rate: rule });
    expect(guard.requireAdmin).toHaveBeenCalledWith("/x", { roles: undefined });
    await openGate({ path: "/x", rate: rule, roles: ["OWNER", "TRANSLATOR"] });
    expect(guard.requireAdmin).toHaveBeenLastCalledWith("/x", { roles: ["OWNER", "TRANSLATOR"] });
  });
  it("runs the rate limit before the step-up and the step-up before handing out a context", async () => {
    guard.hasFreshStepUp.mockResolvedValue(false);
    expect(await openGate({ path: "/x", rate: rule, stepUp: true })).toMatchObject({ ok: false, result: { code: "STEP_UP_REQUIRED" } });
    expect(await openGate({ path: "/x", rate: rule, stepUp: true })).toMatchObject({ ok: false, result: { code: "STEP_UP_REQUIRED" } });
    expect(await openGate({ path: "/x", rate: rule, stepUp: true })).toMatchObject({ ok: false, result: { code: "RATE_LIMITED" } });
  });
  it("hands out an admin context carrying request id, IP and user agent, and refuses writes on sample data", async () => {
    const g = await openGate({ path: "/x", rate: rule });
    expect(g.ok && g.ctx).toMatchObject({ actor: { type: "admin", userId: "adm1" }, requestId: "ray9", client: { ip: "203.0.113.7", userAgent: "Mozilla/5.0 test" } });
    vi.stubEnv("ADMIN_DEV_FIXTURES", "1");
    vi.stubEnv("NODE_ENV", "development");
    expect(await openGate({ path: "/x", rate: rule })).toMatchObject({ ok: false, result: { code: "SAMPLE_DATA" } });
    vi.unstubAllEnvs();
  });
  it("gives a translator context the allowed languages", async () => {
    guard.requireAdmin.mockResolvedValueOnce({ userId: "t1", email: "t@x", name: "T", role: "TRANSLATOR", languages: ["de"], sessionCreatedAt: "", stepUpSecondsLeft: 0 });
    const g = await openGate({ path: "/x", rate: rule, roles: ["TRANSLATOR"] });
    expect(g.ok && g.ctx.allowedLanguages).toEqual(["de"]);
  });
});

describe("audit rows carry the request context (ADM-14)", () => {
  it("copies ip and user agent from ctx.client, and an explicit value wins", async () => {
    const create = vi.fn(async () => ({ id: "1" }));
    const ctx = createAppContext({ prisma: { auditLog: { create } } as never, actor: { type: "admin", userId: "a" }, client: { ip: "203.0.113.7", userAgent: "UA" } });
    await recordAuditEvent(ctx, { action: "X" });
    await recordAuditEvent(ctx, { action: "Y", ip: "198.51.100.1" });
    const calls = create.mock.calls as unknown as [{ data: { ip: string; userAgent: string } }][];
    expect(calls[0][0].data).toMatchObject({ ip: "203.0.113.7", userAgent: "UA" });
    expect(calls[1][0].data.ip).toBe("198.51.100.1");
  });
});
