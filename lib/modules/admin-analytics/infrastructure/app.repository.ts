/**
 * Read-only queries on the site's own database for the analytics screens (cohorts, annotations, titles,
 * live tips and comments). Bounded by a time window or `take`; selects only the columns it shows.
 */
import type { ReadDb } from "@/lib/modules/shared/db";
import type { AppRepository, PremiereInfo, VideoInfo } from "./ports";

const REVENUE_STATUSES = ["SUCCEEDED", "PARTIALLY_REFUNDED"] as const;
const MAX_ROWS = 20_000;

/** "12:45" or "1:02:03" to seconds; null when the text is not a duration. */
export function parseDurationText(text: string | null | undefined): number | null {
  if (!text) return null;
  const parts = text.trim().split(":").map(Number);
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => !Number.isFinite(p) || p < 0)) return null;
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

export class PrismaAppRepository implements AppRepository {
  constructor(private db: ReadDb) {}

  async videosByIds(ids: string[]): Promise<VideoInfo[]> {
    if (ids.length === 0) return [];
    const rows = await this.db.video.findMany({ where: { id: { in: ids.slice(0, 200) } }, select: { id: true, title: true, slug: true, duration: true }, take: 200 });
    return rows.map((r) => ({ id: r.id, title: r.title, slug: r.slug, durationSeconds: parseDurationText(r.duration) }));
  }

  async videoBySlugOrId(key: string): Promise<VideoInfo | null> {
    const r = await this.db.video.findFirst({ where: { OR: [{ slug: key }, { id: key }] }, select: { id: true, title: true, slug: true, duration: true } });
    return r ? { id: r.id, title: r.title, slug: r.slug, durationSeconds: parseDurationText(r.duration) } : null;
  }

  async accountsCreatedAt(from: Date, to: Date): Promise<Date[]> {
    const rows = await this.db.user.findMany({ where: { createdAt: { gte: from, lte: to }, isDeleted: false }, select: { createdAt: true }, take: MAX_ROWS });
    return rows.map((r) => r.createdAt);
  }

  async paymentsCreatedAt(from: Date, to: Date): Promise<Date[]> {
    const rows = await this.db.payment.findMany({ where: { createdAt: { gte: from, lte: to }, status: { in: [...REVENUE_STATUSES] } }, select: { createdAt: true }, take: MAX_ROWS });
    return rows.map((r) => r.createdAt);
  }

  async accountCohort(from: Date, to: Date) {
    const base = { createdAt: { gte: from, lte: to }, isDeleted: false };
    const [accounts, commenters, tippers] = await Promise.all([
      this.db.user.count({ where: base }),
      this.db.user.count({ where: { ...base, comments: { some: {} } } }),
      this.db.user.count({ where: { ...base, payments: { some: { status: { in: [...REVENUE_STATUSES] } } } } }),
    ]);
    return { accounts, commenters, tippers };
  }

  async publishedVideos(from: Date, to: Date, limit: number) {
    const rows = await this.db.video.findMany({
      where: { status: "PUBLISHED", publishedAt: { gte: from, lte: to } },
      select: { publishedAt: true, premiereAt: true, title: true },
      orderBy: { publishedAt: "asc" },
      take: Math.min(50, limit),
    });
    return rows.flatMap((r) => (r.publishedAt ? [{ at: r.premiereAt && r.premiereAt > r.publishedAt ? r.premiereAt : r.publishedAt, title: r.title }] : []));
  }

  async activePremiere(now: Date): Promise<PremiereInfo | null> {
    const day = 86_400_000;
    const rows = await this.db.video.findMany({
      where: { status: "PUBLISHED", premiereAt: { gte: new Date(now.getTime() - day), lte: new Date(now.getTime() + day) } },
      select: { id: true, title: true, slug: true, premiereAt: true },
      take: 10,
    });
    const items = rows.flatMap((r) => (r.premiereAt ? [{ id: r.id, title: r.title, slug: r.slug, premiereAt: r.premiereAt }] : []));
    items.sort((a, b) => Math.abs(a.premiereAt.getTime() - now.getTime()) - Math.abs(b.premiereAt.getTime() - now.getTime()));
    return items[0] ?? null;
  }

  async tipsSince(since: Date) {
    const rows = await this.db.payment.findMany({
      where: { createdAt: { gte: since }, status: { in: [...REVENUE_STATUSES] } },
      select: { amountMinor: true, refundedAmountMinor: true, currency: true },
      take: 500,
    });
    const currencies = new Set(rows.map((r) => r.currency));
    return {
      count: rows.length,
      // Mixed currencies cannot be added: report the count only, without a misleading sum.
      totalMinor: currencies.size <= 1 ? rows.reduce((a, r) => a + r.amountMinor - r.refundedAmountMinor, 0) : 0,
      currency: currencies.size === 1 ? [...currencies][0] : null,
    };
  }

  async commentsSince(since: Date): Promise<number> {
    return this.db.comment.count({ where: { createdAt: { gte: since } } });
  }
}
