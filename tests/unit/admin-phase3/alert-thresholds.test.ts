import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_LIMIT_THRESHOLDS,
  getAlertThresholds,
  hostLimits,
  parseStoredThresholds,
  resetAlertThresholds,
  saveAlertThresholds,
  validateThresholds,
  type LimitThresholds,
} from "@/lib/modules/admin-overview";
import { buildHealthChecks, type HealthInputs } from "@/lib/modules/admin-overview/application/collect-health";
import type { AppContext } from "@/lib/modules/shared/app-context";

const audit = vi.hoisted(() => ({ recordAuditEvent: vi.fn(async () => undefined) }));
vi.mock("@/lib/modules/audit", () => audit);

const custom: LimitThresholds = { disk: { warnAt: 50, critAt: 70 }, memoryUsed: { warnAt: 60, critAt: 80 }, swap: { warnAt: 10, critAt: 30 } };

function makeCtx(stored: string | null, actor: AppContext["actor"] = { type: "admin", userId: "a1" }) {
  const appSetting = {
    findUnique: vi.fn(async () => (stored === null ? null : { key: "admin_alert_thresholds", value: stored, updatedAt: new Date("2026-10-05T10:00:00Z") })),
    upsert: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined),
  };
  const prisma = { appSetting };
  return { ctx: { actor, prisma, db: { read: prisma, writeTransaction: async (fn: (tx: unknown) => unknown) => fn(prisma) } } as unknown as AppContext, appSetting };
}

describe("threshold rules", () => {
  it("accepts the defaults and refuses warn >= crit, non-integers and out-of-range values with Polish messages", () => {
    expect(validateThresholds(DEFAULT_LIMIT_THRESHOLDS)).toEqual({});
    const bad = validateThresholds({ disk: { warnAt: 90, critAt: 80 }, memoryUsed: { warnAt: 0, critAt: 101 }, swap: { warnAt: 10.5, critAt: 30 } });
    expect(bad["disk.critAt"]).toMatch(/wyższy/);
    expect(bad["memoryUsed.warnAt"]).toMatch(/1 do 100/);
    expect(bad["memoryUsed.critAt"]).toMatch(/1 do 100/);
    expect(bad["swap.warnAt"]).toMatch(/całkowita/);
  });

  it("falls back per field on broken stored JSON", () => {
    expect(parseStoredThresholds("not json")).toEqual(DEFAULT_LIMIT_THRESHOLDS);
    expect(parseStoredThresholds(null)).toEqual(DEFAULT_LIMIT_THRESHOLDS);
    const mixed = parseStoredThresholds(JSON.stringify({ disk: { warnAt: 50, critAt: 70 }, swap: { warnAt: 90, critAt: 10 } }));
    expect(mixed.disk).toEqual({ warnAt: 50, critAt: 70 });
    expect(mixed.swap).toEqual(DEFAULT_LIMIT_THRESHOLDS.swap);
  });
});

describe("save / reset use cases", () => {
  it("saves, audits before and after, and is refused for non-admins and invalid input", async () => {
    const { ctx, appSetting } = makeCtx(JSON.stringify(DEFAULT_LIMIT_THRESHOLDS));
    expect(await saveAlertThresholds(ctx, custom)).toMatchObject({ ok: true });
    expect(appSetting.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { key: "admin_alert_thresholds" } }));
    expect(audit.recordAuditEvent).toHaveBeenCalledWith(ctx, expect.objectContaining({ action: "ALERT_THRESHOLDS_UPDATED", metadata: { before: DEFAULT_LIMIT_THRESHOLDS, after: custom } }), expect.anything());
    const invalid = await saveAlertThresholds(ctx, { ...custom, disk: { warnAt: 80, critAt: 50 } });
    expect(invalid).toMatchObject({ ok: false, error: { code: "THRESHOLDS_INVALID" } });
    const user = makeCtx(null, { type: "user", userId: "u" });
    expect(await saveAlertThresholds(user.ctx, custom)).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
  });

  it("reset deletes the row only when there is one", async () => {
    const withRow = makeCtx(JSON.stringify(custom));
    expect(await resetAlertThresholds(withRow.ctx)).toMatchObject({ ok: true, data: { reset: true } });
    expect(withRow.appSetting.delete).toHaveBeenCalled();
    const without = makeCtx(null);
    expect(await resetAlertThresholds(without.ctx)).toMatchObject({ ok: true, data: { reset: false } });
    expect(without.appSetting.delete).not.toHaveBeenCalled();
    expect((await getAlertThresholds(without.ctx)).custom).toBe(false);
  });
});

describe("the thresholds drive the screens", () => {
  const host = { available: true, measuredAt: "2026-10-05T10:00:00Z", source: "test", diskUsedBytes: 55, diskTotalBytes: 100, memTotalBytes: 100, memAvailableBytes: 50, swapTotalBytes: 100, swapUsedBytes: 0 } as never;

  it("hostLimits uses the owner's thresholds and the defaults otherwise", () => {
    expect(hostLimits(host).find((l) => l.id === "disk")).toMatchObject({ warnAt: 80, critAt: 90 });
    expect(hostLimits(host, custom).find((l) => l.id === "disk")).toMatchObject({ warnAt: 50, critAt: 70 });
  });

  it("55% disk is OK by default but a warning with a 50% threshold", () => {
    const base = { now: new Date("2026-10-05T10:00:00Z"), database: { ok: true, latencyMs: 1, detail: "" }, host, hostStatus: { ok: false, reason: "x" }, jobs: [], payments: { disputed: 0, stalePending: 0 }, stripe: { failed: 0, stuck: 0, lastAt: null }, broadcasts: { failed: 0, sending: 0, pendingRecipients: 0 }, probes: { publicApp: null, redis: null, hlsWorker: null }, oldPanel: (p: string) => p } as unknown as HealthInputs;
    const kindOf = (i: HealthInputs) => buildHealthChecks(i).find((c) => c.id === "host")?.kind;
    expect(kindOf(base)).toBe("ok");
    expect(kindOf({ ...base, limits: custom })).toBe("warn");
  });
});
