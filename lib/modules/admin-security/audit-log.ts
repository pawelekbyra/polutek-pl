import type { Prisma } from "@prisma/client";
import type { AppContext } from "@/lib/modules/shared/app-context";
import { AppError } from "@/lib/modules/shared/app-error";
import { toCsv } from "@/lib/modules/shared/csv";
import { recordAuditEvent } from "@/lib/modules/audit";

export const AUDIT_PAGE_SIZE = 30;
const EXPORT_MAX = 20_000;

export type AuditFilters = {
  /** Free text: action, target id or request id (exact-ish, case-insensitive). */
  q?: string;
  actorType?: "admin" | "system" | "user" | "guest";
  targetType?: string;
  from?: Date;
  /** Exclusive upper bound. */
  to?: Date;
  page?: number;
};

export type AuditRow = {
  id: string;
  at: string;
  action: string;
  actorType: string | null;
  actorId: string | null;
  actorLabel: string | null;
  systemReason: string | null;
  targetType: string | null;
  targetId: string | null;
  requestId: string | null;
  ip: string | null;
  metadata: unknown;
};
export type AuditPage = { rows: AuditRow[]; total: number; page: number; totalPages: number; targetTypes: string[] };

const adminOnly = (ctx: AppContext) => {
  if (ctx.actor.type !== "admin") throw new AppError("Only admins can read the audit log", 403, "FORBIDDEN");
};

export function auditWhere(f: AuditFilters): Prisma.AuditLogWhereInput {
  const q = f.q?.trim();
  return {
    ...(f.actorType ? { actorType: f.actorType } : {}),
    ...(f.targetType ? { targetType: f.targetType } : {}),
    ...(f.from || f.to ? { createdAt: { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lt: f.to } : {}) } } : {}),
    ...(q ? { OR: [{ action: { contains: q, mode: "insensitive" } }, { targetId: { equals: q } }, { requestId: { equals: q } }, { actorUserId: { equals: q } }] } : {}),
  };
}

/** Who acted, in words: panel accounts by e-mail; the rest by type. */
async function actorLabels(ctx: AppContext, ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)].filter(Boolean);
  if (!unique.length) return new Map();
  const admins = await ctx.prisma.adminUser.findMany({ where: { id: { in: unique } }, select: { id: true, email: true } });
  return new Map(admins.map((a) => [a.id, a.email]));
}

function toRow(r: { id: string; createdAt: Date; action: string; actorType: string | null; actorUserId: string | null; systemReason: string | null; targetType: string | null; targetId: string | null; requestId: string | null; ip: string | null; metadata: unknown }, labels: Map<string, string>): AuditRow {
  return { id: r.id, at: r.createdAt.toISOString(), action: r.action, actorType: r.actorType, actorId: r.actorUserId, actorLabel: r.actorUserId ? (labels.get(r.actorUserId) ?? null) : null, systemReason: r.systemReason, targetType: r.targetType, targetId: r.targetId, requestId: r.requestId, ip: r.ip, metadata: r.metadata };
}

const SELECT = { id: true, createdAt: true, action: true, actorType: true, actorUserId: true, systemReason: true, targetType: true, targetId: true, requestId: true, ip: true, metadata: true } as const;

export async function listAuditLog(ctx: AppContext, f: AuditFilters): Promise<AuditPage> {
  adminOnly(ctx);
  const page = Math.max(1, Math.floor(f.page ?? 1));
  const where = auditWhere(f);
  const [total, rows, types] = await Promise.all([
    ctx.prisma.auditLog.count({ where }),
    ctx.prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * AUDIT_PAGE_SIZE, take: AUDIT_PAGE_SIZE, select: SELECT }),
    ctx.prisma.auditLog.groupBy({ by: ["targetType"], where: { targetType: { not: null } }, _count: { _all: true }, orderBy: { _count: { targetType: "desc" } }, take: 30 }),
  ]);
  const labels = await actorLabels(ctx, rows.map((r) => r.actorUserId ?? ""));
  return { rows: rows.map((r) => toRow(r, labels)), total, page, totalPages: Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE)), targetTypes: types.map((t) => t.targetType!).filter(Boolean) };
}

/** CSV of the filtered log (contains IP addresses): the caller has passed step-up, the export itself is audited. */
export async function exportAuditCsv(ctx: AppContext, f: AuditFilters): Promise<{ csv: string; rows: number; truncated: boolean }> {
  adminOnly(ctx);
  const rows = await ctx.prisma.auditLog.findMany({ where: auditWhere(f), orderBy: { createdAt: "desc" }, take: EXPORT_MAX + 1, select: SELECT });
  const truncated = rows.length > EXPORT_MAX;
  const data = rows.slice(0, EXPORT_MAX);
  const labels = await actorLabels(ctx, data.map((r) => r.actorUserId ?? ""));
  const csv = toCsv(
    ["czas", "akcja", "aktor_typ", "aktor", "powód_systemowy", "obiekt_typ", "obiekt_id", "żądanie", "ip", "metadane"],
    data.map((r) => [r.createdAt, r.action, r.actorType ?? "", labels.get(r.actorUserId ?? "") ?? r.actorUserId ?? "", r.systemReason ?? "", r.targetType ?? "", r.targetId ?? "", r.requestId ?? "", r.ip ?? "", r.metadata ? JSON.stringify(r.metadata) : ""]),
  );
  await recordAuditEvent(ctx, { action: "AUDIT_EXPORTED", targetType: "AuditLog", metadata: { rows: data.length, truncated, filters: { actorType: f.actorType ?? null, targetType: f.targetType ?? null, q: f.q ? "(set)" : null, from: f.from?.toISOString() ?? null, to: f.to?.toISOString() ?? null } } });
  return { csv, rows: data.length, truncated };
}

export type SiteAdminRow = { id: string; email: string; name: string | null; twoFactor: boolean; passkeys: number; activeSessions: number; lastSessionAt: string | null };

/** Accounts with the ADMIN role on the public site (the old /admin): which of them have 2FA, passkeys, live sessions. */
export async function listSiteAdmins(ctx: AppContext, now: Date = ctx.now()): Promise<SiteAdminRow[]> {
  adminOnly(ctx);
  const users = await ctx.prisma.user.findMany({
    where: { role: "ADMIN", isDeleted: false },
    orderBy: { createdAt: "asc" },
    take: 50,
    select: { id: true, email: true, name: true, twoFactorEnabled: true, _count: { select: { passkeys: true } } },
  });
  if (!users.length) return [];
  const sessions = await ctx.prisma.session.groupBy({ by: ["userId"], where: { userId: { in: users.map((u) => u.id) }, expiresAt: { gt: now } }, _count: { _all: true }, _max: { createdAt: true } });
  return users.map((u) => {
    const s = sessions.find((x) => x.userId === u.id);
    return { id: u.id, email: u.email, name: u.name, twoFactor: !!u.twoFactorEnabled, passkeys: u._count.passkeys, activeSessions: s?._count._all ?? 0, lastSessionAt: s?._max.createdAt?.toISOString() ?? null };
  });
}
