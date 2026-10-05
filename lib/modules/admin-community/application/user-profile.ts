import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { AppError } from "@/lib/modules/shared/app-error";
import { normalizePaymentTotals, UserNotFoundError } from "@/lib/modules/users";

export type ProfilePayment = { id: string; amountMinor: number; refundedAmountMinor: number; currency: string; status: string; createdAt: string };
export type ProfileGrant = { id: string; source: string; reason: string | null; createdAt: string; revokedAt: string | null; revokeReason: string | null; active: boolean };
export type ProfileSession = { id: string; device: string; startedAt: string; lastActiveAt: string; expiresAt: string };
export type ProfileComment = { id: string; text: string | null; status: string; createdAt: string; likesCount: number; videoTitle: string; videoSlug: string };
export type ProfileAudit = { id: string; action: string; createdAt: string; actor: string; reason: string | null; viaPerson: boolean };
export type ProfileWatch = { videoId: string; title: string; slug: string; progressPercent: number | null; watchedMinutes: number };
export type ProfileEmail = { id: string; subject: string; status: string; at: string };

export type UserProfile = {
  id: string;
  name: string;
  email: string;
  isDeleted: boolean;
  role: "ADMIN" | "USER";
  emailVerified: boolean;
  hasPasskey: boolean;
  hasTotp: boolean;
  hasGoogle: boolean;
  hasPassword: boolean;
  onboardingPending: boolean;
  language: string;
  createdAt: string;
  termsAcceptedAt: string | null;
  mute: { until: string; reason: string | null } | null;
  isSupporter: boolean;
  counts: { comments: number; videoLikes: number; payments: number; subscriptions: number; activeGrants: number };
  totalPaidPln: number;
  totalsByCurrency: { currency: string; amountMinor: number }[];
  payments: ProfilePayment[];
  grants: ProfileGrant[];
  sessions: ProfileSession[];
  comments: ProfileComment[];
  audit: ProfileAudit[];
  watching: ProfileWatch[];
  emails: ProfileEmail[];
};

/** "Chrome · Windows" from a User-Agent; coarse on purpose (the raw string and the IP are not shown). */
export function deviceLabel(userAgent: string | null | undefined): string {
  const ua = userAgent ?? "";
  const browser = /edg\//i.test(ua) ? "Edge" : /opr\/|opera/i.test(ua) ? "Opera" : /firefox\//i.test(ua) ? "Firefox" : /chrome\//i.test(ua) ? "Chrome" : /safari\//i.test(ua) ? "Safari" : "przeglądarka";
  const os = /android/i.test(ua) ? "Android" : /iphone|ipad|ios/i.test(ua) ? "iOS" : /windows/i.test(ua) ? "Windows" : /mac os|macintosh/i.test(ua) ? "macOS" : /linux/i.test(ua) ? "Linux" : "nieznany system";
  return `${browser} · ${os}`;
}

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

function auditRow(a: { id: string; action: string; createdAt: Date; actorType: string | null; actorUserId: string | null; metadata: unknown }, userId: string): ProfileAudit {
  const meta = (a.metadata ?? {}) as Record<string, unknown>;
  const reason = [meta.reason, meta.note].find((v): v is string => typeof v === "string" && v.length > 0) ?? null;
  return { id: a.id, action: a.action, createdAt: a.createdAt.toISOString(), actor: a.actorUserId === userId ? "ta osoba" : a.actorType === "system" ? "system" : a.actorType === "admin" ? "administrator" : a.actorType ?? "—", reason, viaPerson: a.actorUserId === userId };
}

/**
 * The 360 profile of one person for the panel: account, tips with totals, supporter-marker history, sessions
 * (device and times only, no IP, no token), recent comments, watching, mailings, and the audit trail about the
 * account. Read only; every list is capped. Not found is a 404 AppError.
 */
export async function getUserProfile(ctx: AppContext, userId: string): Promise<UseCaseResult<UserProfile, AppError>> {
  if (ctx.actor.type !== "admin") return fail(new AppError("Brak uprawnień administratora.", 403, "FORBIDDEN"));
  const db = ctx.prisma;
  const now = ctx.now();
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true, name: true, email: true, isDeleted: true, role: true, emailVerified: true, twoFactorEnabled: true, onboardingPending: true, language: true, createdAt: true, termsAcceptedAt: true, commentMutedUntil: true, commentMuteReason: true,
      paymentTotals: { select: { currency: true, amountMinor: true } },
      accounts: { select: { providerId: true, password: true } },
      _count: { select: { comments: true, videoLikes: true, payments: true, subscriptions: true, passkeys: true } },
    },
  });
  if (!user) return fail(new UserNotFoundError(userId));

  const [payments, grants, sessions, comments, audit, plays, mails] = await Promise.all([
    db.payment.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 50, select: { id: true, amountMinor: true, refundedAmountMinor: true, currency: true, status: true, createdAt: true } }),
    db.patronGrant.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 50, select: { id: true, source: true, reason: true, createdAt: true, revokedAt: true, revokeReason: true } }),
    db.session.findMany({ where: { userId, expiresAt: { gt: now } }, orderBy: { updatedAt: "desc" }, take: 20, select: { id: true, userAgent: true, createdAt: true, updatedAt: true, expiresAt: true } }),
    db.comment.findMany({ where: { authorId: userId }, orderBy: { createdAt: "desc" }, take: 10, select: { id: true, text: true, status: true, deletedReason: true, createdAt: true, likesCount: true, video: { select: { title: true, slug: true } } } }),
    db.auditLog.findMany({ where: { OR: [{ targetType: "User", targetId: userId }, { actorUserId: userId }] }, orderBy: { createdAt: "desc" }, take: 40, select: { id: true, action: true, createdAt: true, actorType: true, actorUserId: true, metadata: true } }),
    db.videoPlaybackSession.findMany({ where: { userId, isAdminPreview: false }, orderBy: { startedAt: "desc" }, take: 200, select: { videoId: true, maxProgressMs: true, durationMs: true, totalWatchMs: true, video: { select: { title: true, slug: true } } } }),
    db.broadcastEmailRecipient.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 8, select: { id: true, status: true, sentAt: true, createdAt: true, broadcast: { select: { subjectPl: true } } } }),
  ]);

  const watchedByVideo = new Map<string, ProfileWatch & { maxMs: number; durMs: number | null; totalMs: number }>();
  for (const p of plays) {
    const cur = watchedByVideo.get(p.videoId) ?? { videoId: p.videoId, title: p.video.title, slug: p.video.slug, progressPercent: null, watchedMinutes: 0, maxMs: 0, durMs: null, totalMs: 0 };
    cur.maxMs = Math.max(cur.maxMs, p.maxProgressMs);
    cur.durMs = p.durationMs ?? cur.durMs;
    cur.totalMs += p.totalWatchMs;
    watchedByVideo.set(p.videoId, cur);
  }
  const watching = [...watchedByVideo.values()]
    .map((w): ProfileWatch => ({ videoId: w.videoId, title: w.title, slug: w.slug, progressPercent: w.durMs ? Math.min(100, Math.round((w.maxMs / w.durMs) * 100)) : null, watchedMinutes: Math.round(w.totalMs / 60_000) }))
    .sort((a, b) => b.watchedMinutes - a.watchedMinutes)
    .slice(0, 6);

  const activeGrants = grants.filter((g) => !g.revokedAt).length;
  const muted = user.commentMutedUntil && user.commentMutedUntil > now;
  return ok({
    id: user.id,
    name: user.isDeleted ? "Usunięte konto" : user.name?.trim() || "(bez pseudonimu)",
    email: user.isDeleted ? "" : user.email,
    isDeleted: user.isDeleted,
    role: user.role,
    emailVerified: user.emailVerified,
    hasPasskey: user._count.passkeys > 0,
    hasTotp: user.twoFactorEnabled === true,
    hasGoogle: user.accounts.some((a) => a.providerId === "google"),
    hasPassword: user.accounts.some((a) => a.providerId === "credential" && !!a.password),
    onboardingPending: user.onboardingPending,
    language: user.language,
    createdAt: user.createdAt.toISOString(),
    termsAcceptedAt: iso(user.termsAcceptedAt),
    mute: muted ? { until: user.commentMutedUntil!.toISOString(), reason: user.commentMuteReason } : null,
    isSupporter: activeGrants > 0,
    counts: { comments: user._count.comments, videoLikes: user._count.videoLikes, payments: user._count.payments, subscriptions: user._count.subscriptions, activeGrants },
    totalPaidPln: normalizePaymentTotals(user.paymentTotals),
    totalsByCurrency: user.paymentTotals,
    payments: payments.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() })),
    grants: grants.map((g) => ({ id: g.id, source: g.source, reason: g.reason, createdAt: g.createdAt.toISOString(), revokedAt: iso(g.revokedAt), revokeReason: g.revokeReason, active: !g.revokedAt })),
    sessions: sessions.map((s) => ({ id: s.id, device: deviceLabel(s.userAgent), startedAt: s.createdAt.toISOString(), lastActiveAt: s.updatedAt.toISOString(), expiresAt: s.expiresAt.toISOString() })),
    comments: comments.map((c) => ({ id: c.id, text: c.deletedReason === "AUTHOR_DELETED" ? null : c.text, status: c.status, createdAt: c.createdAt.toISOString(), likesCount: Math.max(0, c.likesCount), videoTitle: c.video?.title ?? "—", videoSlug: c.video?.slug ?? "" })),
    audit: audit.map((a) => auditRow(a, userId)),
    watching,
    emails: mails.map((m) => ({ id: m.id, subject: m.broadcast.subjectPl, status: m.status, at: (m.sentAt ?? m.createdAt).toISOString() })),
  });
}
