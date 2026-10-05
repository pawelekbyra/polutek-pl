/**
 * Data of the "Społeczność" screens (users, comments, reports): the same use cases as the old /admin, read with
 * an admin actor (the comment use cases require it). Labelled sample data under ADMIN_DEV_FIXTURES=1.
 */
import { CommentReportStatus, CommentStatus } from "@prisma/client";
import { listAdminComments, listCommentReports, type CommentDto } from "@/lib/modules/comments";
import { getAdminUserDetails, getAdminUsersStats, listAdminUsers, type AdminUserDetailsDto, type AdminUserListItemDto } from "@/lib/modules/users";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { isDevFixturesEnabled } from "./config";

export const COMMUNITY_PAGE_SIZE = 25;
const readCtx = () => createAppContext({ actor: { type: "admin", userId: "panel-read" } });

export type UserFilters = { q?: string; role?: "ADMIN" | "USER"; deleted?: boolean; payers?: boolean; page: number };
export type UserList = { items: AdminUserListItemDto[]; total: number; page: number; totalPages: number; stats: { totalUsers: number; activeUsers: number; patrons: number; totalPayments: number } | null };

export async function loadUsers(f: UserFilters): Promise<UserList> {
  if (isDevFixturesEnabled()) return fixtureUsers(f);
  const ctx = readCtx();
  const [list, stats] = await Promise.all([
    listAdminUsers({ query: f.q || undefined, role: f.role, isDeleted: f.deleted, hasPayments: f.payers || undefined, page: f.page, pageSize: COMMUNITY_PAGE_SIZE, orderBy: "createdAt", orderDir: "desc" }, ctx),
    getAdminUsersStats(ctx).catch(() => null),
  ]);
  return { items: list.items, total: list.total, page: list.page, totalPages: list.totalPages, stats };
}

export async function loadUser(id: string): Promise<AdminUserDetailsDto | null> {
  if (isDevFixturesEnabled()) return fixtureUser(id);
  const res = await getAdminUserDetails(id, readCtx());
  return res.ok ? res.data : null;
}

export type CommentFilters = { q?: string; status?: CommentStatus; page: number };
export type CommentList = { items: CommentDto[]; total: number; page: number; totalPages: number };

export async function loadComments(f: CommentFilters): Promise<CommentList> {
  if (isDevFixturesEnabled()) return { items: [], total: 0, page: 1, totalPages: 0 };
  const res = await listAdminComments({ q: f.q || undefined, status: f.status, page: f.page, pageSize: COMMUNITY_PAGE_SIZE }, readCtx());
  if (!res.ok) throw new Error(res.error.message);
  return res.data;
}

export type ReportRow = { id: string; reason: string; note: string | null; status: string; createdAt: string; reporter: string; comment: { id: string; text: string | null; status: string; author: string; videoTitle: string; videoSlug: string } };

export async function loadReports(status: CommentReportStatus, page: number): Promise<{ items: ReportRow[]; total: number; page: number; totalPages: number }> {
  if (isDevFixturesEnabled()) return { items: [], total: 0, page: 1, totalPages: 0 };
  const res = await listCommentReports({ status, page, pageSize: COMMUNITY_PAGE_SIZE }, readCtx());
  if (!res.ok) throw new Error(res.error.message);
  return {
    ...res.data,
    items: res.data.items.map((r) => ({
      id: r.id,
      reason: r.reason,
      note: r.note,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      reporter: r.reporter?.name ?? "usunięte konto",
      comment: {
        id: r.comment.id,
        // The report queue shows what was reported, also hidden or held text (moderation evidence).
        text: r.comment.deletedReason === "AUTHOR_DELETED" ? null : r.comment.text,
        status: r.comment.status,
        author: r.comment.author?.name ?? "usunięte konto",
        videoTitle: r.comment.video?.title ?? "—",
        videoSlug: r.comment.video?.slug ?? "",
      },
    })),
  };
}

// ---------------------------------------------------------------- sample data (next dev only)

const DAY = 86_400_000;
const sampleUser = (i: number, over: Partial<AdminUserListItemDto> = {}): AdminUserListItemDto =>
  ({
    id: `u${i}`,
    email: `osoba${i}@example.com`,
    name: ["kasia_k", "marek", "Ola Nowak", "tomek88", "Paweł Perfect"][i % 5],
    username: null,
    imageUrl: null,
    role: i === 4 ? "ADMIN" : "USER",
    isPatron: i % 3 === 0,
    isDeleted: false,
    patronSince: null,
    patronSource: null,
    activeGrantSince: null,
    activeGrantSource: null,
    activeGrantCount: i % 3 === 0 ? 1 : 0,
    language: i % 2 ? "en" : "pl",
    createdAt: new Date(Date.now() - i * 7 * DAY),
    updatedAt: new Date(),
    hasSubscriptions: i % 2 === 0,
    paymentCount: i % 3 === 0 ? 2 : 0,
    lastPaymentAt: i % 3 === 0 ? new Date(Date.now() - i * DAY) : null,
    paymentTotals: i % 3 === 0 ? [{ currency: "PLN", totalPaidMinor: 2500 * (i + 1) }] : [],
    normalizedTotal: i % 3 === 0 ? 25 * (i + 1) : 0,
    ...over,
  }) as unknown as AdminUserListItemDto;

function fixtureUsers(f: UserFilters): UserList {
  const all = Array.from({ length: 6 }, (_, i) => sampleUser(i));
  const items = all.filter((u) => (!f.q || `${u.name} ${u.email}`.toLowerCase().includes(f.q.toLowerCase())) && (!f.role || u.role === f.role) && (!f.payers || u.paymentCount > 0));
  return { items, total: items.length, page: 1, totalPages: 1, stats: { totalUsers: 6, activeUsers: 6, patrons: 2, totalPayments: 4 } };
}

function fixtureUser(id: string): AdminUserDetailsDto | null {
  const i = Number(id.replace(/^u/, ""));
  if (!Number.isInteger(i) || i < 0 || i > 5) return null;
  const u = sampleUser(i);
  return {
    ...(u as unknown as AdminUserDetailsDto),
    emailVerified: true,
    stripeCustomerId: null,
    _count: { comments: 7, videoLikes: 3, videoDislikes: 0 },
    patronGrants: [],
    payments: u.paymentCount ? [{ id: `p${i}`, amountMinor: 2500, currency: "PLN", status: "SUCCEEDED", createdAt: new Date(Date.now() - 2 * DAY), refundedAmountMinor: 0 }] : [],
    subscriptions: [],
    auditLogs: [],
  } as unknown as AdminUserDetailsDto;
}
