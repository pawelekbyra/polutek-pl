import type { AppContext } from "@/lib/modules/shared/app-context";
import { listVipUserIds } from "@/lib/modules/patron-zone";

type RowWithAuthor = {
  authorId: string;
  author?: { isDeleted?: boolean } | null;
  replies?: RowWithAuthor[];
};

/** The distinct author ids of these rows and of their reply previews (deleted accounts have no marker, so they are left out). */
export function collectAuthorIds(rows: readonly RowWithAuthor[]): string[] {
  const ids = new Set<string>();
  const visit = (row: RowWithAuthor) => {
    if (row.author?.isDeleted !== true) ids.add(row.authorId);
    row.replies?.forEach(visit);
  };
  rows.forEach(visit);
  return [...ids];
}

/**
 * The authors among these rows with an active PAID patron-zone access ("VIP" badge): ONE batched query for the whole
 * page, never one per comment. Purely decorative, so a failure only drops the badges and never breaks the comments.
 */
export async function loadVipAuthorIds(ctx: Pick<AppContext, "prisma" | "now">, rows: readonly RowWithAuthor[]): Promise<ReadonlySet<string> | undefined> {
  const ids = collectAuthorIds(rows);
  if (ids.length === 0) return new Set();
  try {
    return await listVipUserIds(ctx.prisma, ids, ctx.now());
  } catch (error) {
    console.warn("[comments] VIP badges skipped", error instanceof Error ? error.message : "unknown");
    return undefined; // unknown: no VIP and no BASE badges (never call a VIP "Normik")
  }
}
