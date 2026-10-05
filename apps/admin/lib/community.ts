/**
 * Data of the "Społeczność" screens: the module read models with an admin actor (the panel layout already
 * required a signed-in owner). Errors surface as exceptions so the segment error page shows them, never an
 * empty list that looks like "no data". Under ADMIN_DEV_FIXTURES=1 (no database) lists are empty and say so.
 */
import { findFilmBySlug, getPanelUserStats, getUserProfile, listFilmOptions, listPanelUsers, type FilmOption, type PanelUserFilters, type PanelUserList, type PanelUserStats, type UserProfile } from "@/lib/modules/admin-community";
import { getModerationCounts, listModerationQueue, listPanelComments, listResolvedReports, type PanelComment, type PanelPage, type ResolvedReportRow } from "@/lib/modules/comments";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { isDevFixturesEnabled } from "./config";

export const COMMUNITY_PAGE_SIZE = 25;
const readCtx = () => createAppContext({ actor: { type: "admin", userId: "panel-read" } });
const empty = <T,>(): PanelPage<T> => ({ items: [], total: 0, page: 1, pageSize: COMMUNITY_PAGE_SIZE, totalPages: 0 });

function unwrap<T>(r: { ok: true; data: T } | { ok: false; error: unknown }): T {
  if (!r.ok) throw r.error instanceof Error ? r.error : new Error((r.error as { message?: string })?.message ?? "Nie udało się wczytać danych.");
  return r.data;
}

export async function loadUsers(f: PanelUserFilters & { page: number }): Promise<{ list: PanelUserList; stats: PanelUserStats | null }> {
  if (isDevFixturesEnabled()) return { list: empty(), stats: null };
  const ctx = readCtx();
  const [list, stats] = await Promise.all([listPanelUsers(ctx, { ...f, pageSize: COMMUNITY_PAGE_SIZE }), getPanelUserStats(ctx)]);
  return { list: unwrap(list), stats: unwrap(stats) };
}

export async function loadProfile(id: string): Promise<UserProfile | null> {
  if (isDevFixturesEnabled()) return null;
  const res = await getUserProfile(readCtx(), id);
  if (!res.ok) {
    if ((res.error as { statusCode?: number }).statusCode === 404) return null;
    throw res.error;
  }
  return res.data;
}

export async function loadQueue(page: number): Promise<PanelPage<PanelComment>> {
  return isDevFixturesEnabled() ? empty() : unwrap(await listModerationQueue(readCtx(), { page, pageSize: COMMUNITY_PAGE_SIZE }));
}

export async function loadResolved(page: number): Promise<PanelPage<ResolvedReportRow>> {
  return isDevFixturesEnabled() ? empty() : unwrap(await listResolvedReports(readCtx(), { page, pageSize: COMMUNITY_PAGE_SIZE }));
}

export type CommentQuery = { q?: string; status?: string; videoId?: string; authorId?: string; page: number };

export async function loadComments(f: CommentQuery): Promise<PanelPage<PanelComment>> {
  if (isDevFixturesEnabled()) return empty();
  const unanswered = f.status === "Q";
  const status = !unanswered && f.status && ["VISIBLE", "HELD_FOR_REVIEW", "HIDDEN", "DELETED"].includes(f.status) ? (f.status as "VISIBLE" | "HELD_FOR_REVIEW" | "HIDDEN" | "DELETED") : undefined;
  return unwrap(await listPanelComments(readCtx(), { q: f.q || undefined, status, unansweredQuestions: unanswered, videoId: f.videoId, authorId: f.authorId, page: f.page, pageSize: COMMUNITY_PAGE_SIZE }));
}

export async function loadModerationCounts(): Promise<{ comments: number; held: number; pendingReports: number }> {
  if (isDevFixturesEnabled()) return { comments: 0, held: 0, pendingReports: 0 };
  return unwrap(await getModerationCounts(readCtx()));
}

export async function loadFilmOptions(): Promise<FilmOption[]> {
  return isDevFixturesEnabled() ? [] : listFilmOptions(readCtx());
}

export async function loadFilm(slug: string): Promise<FilmOption | null> {
  return isDevFixturesEnabled() ? null : findFilmBySlug(readCtx(), slug);
}
