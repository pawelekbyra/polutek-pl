import type { ReadDb } from "@/lib/modules/shared/db";
import { fmtMoney } from "../domain/format";

export type SearchHit = { group: "Filmy" | "Osoby" | "Płatności"; label: string; hint: string; href: string };

/**
 * Object search of the command palette (read only, max 5 per group). Matches titles/slugs, nicknames and
 * e-mails case-insensitively, payments by id or Stripe intent prefix. Links lead to the old /admin until
 * the sections move to the panel.
 */
export async function searchAdminObjects(db: ReadDb, rawQuery: string, oldPanel: (path: string) => string): Promise<SearchHit[]> {
  const q = rawQuery.trim().slice(0, 80);
  if (q.length < 2) return [];
  const contains = { contains: q, mode: "insensitive" as const };
  const [videos, users, payments] = await Promise.all([
    db.video.findMany({
      where: { OR: [{ title: contains }, { slug: contains }] },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, title: true, slug: true, status: true },
    }),
    db.user.findMany({
      where: { isDeleted: false, OR: [{ name: contains }, { email: contains }] },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, name: true, email: true },
    }),
    q.length >= 4
      ? db.payment.findMany({
          where: { OR: [{ id: { startsWith: q } }, { stripeIntentId: { startsWith: q } }] },
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { id: true, userId: true, amountMinor: true, currency: true, status: true, stripeIntentId: true },
        })
      : Promise.resolve([]),
  ]);
  return [
    ...videos.map((v) => ({ group: "Filmy" as const, label: v.title, hint: v.slug, href: `/tresci/${encodeURIComponent(v.slug)}` })),
    ...users.map((u) => ({ group: "Osoby" as const, label: u.name || "(bez pseudonimu)", hint: u.email, href: oldPanel(`/admin/users/${u.id}`) })),
    ...payments.map((p) => ({
      group: "Płatności" as const,
      label: `${fmtMoney(p.amountMinor, p.currency)} · ${p.status}`,
      hint: `${(p.stripeIntentId ?? p.id).slice(0, 14)}…`,
      href: oldPanel(`/admin/users/${p.userId}`),
    })),
  ];
}
