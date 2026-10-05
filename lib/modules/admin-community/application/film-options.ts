import { AppContext } from "@/lib/modules/shared/app-context";

export type FilmOption = { id: string; slug: string; title: string };

/** Films for the "Film" filter of the comments list (newest first, capped; a channel has a handful). */
export async function listFilmOptions(ctx: AppContext): Promise<FilmOption[]> {
  if (ctx.actor.type !== "admin") return [];
  return ctx.prisma.video.findMany({ orderBy: { updatedAt: "desc" }, take: 100, select: { id: true, slug: true, title: true } });
}

export async function findFilmBySlug(ctx: AppContext, slug: string): Promise<FilmOption | null> {
  if (ctx.actor.type !== "admin") return null;
  return ctx.prisma.video.findUnique({ where: { slug }, select: { id: true, slug: true, title: true } });
}
