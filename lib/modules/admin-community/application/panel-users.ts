import { Prisma } from "@prisma/client";
import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { AppError } from "@/lib/modules/shared/app-error";
import { normalizePaymentTotals } from "@/lib/modules/users";
import { REVENUE_STATUSES } from "@/lib/modules/admin-overview";

export const USER_SEGMENTS = ["nowi", "aktywni", "wspierajacy", "platnicy", "niezweryfikowani", "2fa", "wyciszeni", "administratorzy", "usunieci"] as const;
export type UserSegment = (typeof USER_SEGMENTS)[number];
export const USER_SORTS = ["created-desc", "created-asc", "nick-asc", "nick-desc", "wplaty-desc", "wplaty-asc"] as const;
export type UserSort = (typeof USER_SORTS)[number];

export type PanelUserFilters = { q?: string; seg?: UserSegment; sort?: UserSort };
export const NEW_USER_DAYS = 7;
export const ACTIVE_USER_DAYS = 30;
const DAY_MS = 86_400_000;

export type PanelUserRow = {
  id: string;
  name: string;
  email: string;
  isDeleted: boolean;
  role: "ADMIN" | "USER";
  emailVerified: boolean;
  hasSecondFactor: boolean;
  mutedUntil: string | null;
  isSupporter: boolean;
  createdAt: string;
  lastSeenAt: string | null;
  language: string;
  commentsCount: number;
  paymentsCount: number;
  /** Sum of the person's tips converted to PLN with the display rates (approximate, for orientation). */
  tipsPln: number;
};

export type PanelUserList = { items: PanelUserRow[]; total: number; page: number; pageSize: number; totalPages: number };

const forbidden = () => fail(new AppError("Brak uprawnień administratora.", 403, "FORBIDDEN"));

/** The WHERE of a segment/search; shared by the list and the CSV export so both always agree. */
export function panelUserWhere(f: PanelUserFilters, now: Date): Prisma.UserWhereInput {
  const and: Prisma.UserWhereInput[] = [];
  if (f.q) and.push({ OR: [{ email: { contains: f.q, mode: "insensitive" } }, { name: { contains: f.q, mode: "insensitive" } }, { username: { contains: f.q, mode: "insensitive" } }] });
  // Deleted accounts are anonymised tombstones: hidden unless asked for.
  if (f.seg === "usunieci") and.push({ isDeleted: true });
  else and.push({ isDeleted: false });
  switch (f.seg) {
    case "nowi": and.push({ createdAt: { gte: new Date(now.getTime() - NEW_USER_DAYS * DAY_MS) } }); break;
    case "aktywni": and.push({ sessions: { some: { updatedAt: { gte: new Date(now.getTime() - ACTIVE_USER_DAYS * DAY_MS) } } } }); break;
    case "wspierajacy": and.push({ patronGrants: { some: { revokedAt: null } } }); break;
    case "platnicy": and.push({ payments: { some: { status: { in: [...REVENUE_STATUSES] } } } }); break;
    case "niezweryfikowani": and.push({ emailVerified: false }); break;
    case "2fa": and.push({ OR: [{ twoFactorEnabled: true }, { passkeys: { some: {} } }] }); break;
    case "wyciszeni": and.push({ commentMutedUntil: { gt: now } }); break;
    case "administratorzy": and.push({ role: "ADMIN" }); break;
  }
  return { AND: and };
}

function orderBy(sort: UserSort = "created-desc"): Prisma.UserOrderByWithRelationInput[] {
  const dir = sort.endsWith("asc") ? "asc" : "desc";
  if (sort.startsWith("nick")) return [{ name: { sort: dir, nulls: "last" } }, { id: "asc" }];
  if (sort.startsWith("wplaty")) return [{ payments: { _count: dir } }, { createdAt: "desc" }, { id: "asc" }];
  return [{ createdAt: dir }, { id: "asc" }];
}

/** Accounts with search, one segment, sort and pages (25 per page). Admin only; the segment names are the URL values. */
export async function listPanelUsers(ctx: AppContext, input: PanelUserFilters & { page?: number; pageSize?: number }): Promise<UseCaseResult<PanelUserList, AppError>> {
  if (ctx.actor.type !== "admin") return forbidden();
  const page = Math.max(1, Math.floor(input.page || 1));
  const pageSize = Math.max(1, Math.min(100, Math.floor(input.pageSize || 25)));
  const now = ctx.now();
  const where = panelUserWhere(input, now);
  const [users, total] = await Promise.all([
    ctx.prisma.user.findMany({
      where,
      orderBy: orderBy(input.sort),
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, name: true, email: true, isDeleted: true, role: true, emailVerified: true, twoFactorEnabled: true, commentMutedUntil: true, createdAt: true, language: true,
        paymentTotals: { select: { currency: true, amountMinor: true } },
        patronGrants: { where: { revokedAt: null }, select: { id: true }, take: 1 },
        _count: { select: { comments: true, passkeys: true, payments: { where: { status: { in: [...REVENUE_STATUSES] } } } } },
      },
    }),
    ctx.prisma.user.count({ where }),
  ]);
  const seen = users.length ? await ctx.prisma.session.groupBy({ by: ["userId"], where: { userId: { in: users.map((u) => u.id) } }, _max: { updatedAt: true } }) : [];
  const lastSeen = new Map(seen.map((s) => [s.userId, s._max.updatedAt]));
  return ok({
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
    items: users.map((u): PanelUserRow => ({
      id: u.id,
      name: u.isDeleted ? "Usunięte konto" : u.name?.trim() || "(bez pseudonimu)",
      email: u.isDeleted ? "" : u.email,
      isDeleted: u.isDeleted,
      role: u.role,
      emailVerified: u.emailVerified,
      hasSecondFactor: u.twoFactorEnabled === true || u._count.passkeys > 0,
      mutedUntil: u.commentMutedUntil && u.commentMutedUntil > now ? u.commentMutedUntil.toISOString() : null,
      isSupporter: u.patronGrants.length > 0,
      createdAt: u.createdAt.toISOString(),
      lastSeenAt: lastSeen.get(u.id)?.toISOString() ?? null,
      language: u.language,
      commentsCount: u._count.comments,
      paymentsCount: u._count.payments,
      tipsPln: normalizePaymentTotals(u.paymentTotals),
    })),
  });
}

export type PanelUserStats = { accounts: number; newInWeek: number; supporters: number; unverified: number };

/** The four tiles above the list. Each count is one indexed `count`, no rows are loaded. */
export async function getPanelUserStats(ctx: AppContext): Promise<UseCaseResult<PanelUserStats, AppError>> {
  if (ctx.actor.type !== "admin") return forbidden();
  const now = ctx.now();
  const live = { isDeleted: false };
  const [accounts, newInWeek, supporters, unverified] = await Promise.all([
    ctx.prisma.user.count({ where: live }),
    ctx.prisma.user.count({ where: { ...live, createdAt: { gte: new Date(now.getTime() - NEW_USER_DAYS * DAY_MS) } } }),
    ctx.prisma.user.count({ where: { ...live, patronGrants: { some: { revokedAt: null } } } }),
    ctx.prisma.user.count({ where: { ...live, emailVerified: false } }),
  ]);
  return ok({ accounts, newInWeek, supporters, unverified });
}
