/**
 * Film translations for the admin panel: list per language, save (title, address, description), approve,
 * approve all. "en" stays in sync with Video.titleEn/descriptionEn, which the site reads today. Address
 * changes go to VideoSlugHistory for future 301s. No AI here: generating drafts is the next step.
 */
import type { AppContext } from "@/lib/modules/shared/app-context";
import { AppError } from "@/lib/modules/shared/app-error";
import { fail, ok, type UseCaseResult } from "@/lib/modules/shared/result";
import { recordAuditEventSafe } from "@/lib/modules/audit";
import { MainChannelService } from "@/lib/modules/channel";
import { updateAdminVideo } from "@/lib/modules/video";
import { TRANSLATION_LANGUAGES, isTranslationLanguage, type TranslationLanguage } from "../domain/languages";
import { isValidSlug, uniqueSlug } from "../domain/slug";
import type { TranslationStatus } from "../domain/public-meta";

export type TranslationRowDto = {
  language: TranslationLanguage;
  /** null = no translation in this language yet. */
  translation: { id: string; title: string; slug: string; description: string | null; subtitleUrl: string | null; status: TranslationStatus; reviewedAt: string | null; updatedAt: string } | null;
};

export type FilmTranslationsDto = {
  video: { id: string; slug: string; title: string; description: string | null; subtitleUrlPl: string | null; updatedAt: string };
  rows: TranslationRowDto[];
};

/** A TRANSLATOR account (ctx.allowedLanguages set) may write only its granted languages and never approves. */
const languageDenied = (ctx: AppContext, language: string) => (ctx.allowedLanguages && !ctx.allowedLanguages.includes(language) ? new AppError("Nie masz uprawnień do tego języka.", 403, "LANGUAGE_NOT_GRANTED") : null);

const actorId = (ctx: AppContext) => (ctx.actor.type === "admin" ? ctx.actor.userId : null);

async function requireFilm(idOrSlug: string, ctx: AppContext) {
  const channel = await MainChannelService.getRequired(ctx);
  const video = await ctx.prisma.video.findFirst({
    where: { creatorId: channel.id, OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    select: { id: true, slug: true, title: true, description: true, subtitleUrlPl: true, subtitleUrlEn: true, titleEn: true, descriptionEn: true, updatedAt: true },
  });
  if (!video) throw new AppError("Ten film już nie istnieje.", 404, "VIDEO_NOT_FOUND");
  return video;
}

export async function listFilmTranslations(idOrSlug: string, ctx: AppContext): Promise<UseCaseResult<FilmTranslationsDto, AppError>> {
  try {
    const video = await requireFilm(idOrSlug, ctx);
    const rows = await ctx.prisma.videoTranslation.findMany({ where: { videoId: video.id } });
    return ok({
      video: { id: video.id, slug: video.slug, title: video.title, description: video.description, subtitleUrlPl: video.subtitleUrlPl, updatedAt: video.updatedAt.toISOString() },
      rows: TRANSLATION_LANGUAGES.map((language) => {
        const t = rows.find((r) => r.language === language.code);
        if (t) {
          return { language, translation: { id: t.id, title: t.title, slug: t.slug, description: t.description, subtitleUrl: t.subtitleUrl ?? (language.code === "en" ? video.subtitleUrlEn : null), status: t.status, reviewedAt: t.reviewedAt?.toISOString() ?? null, updatedAt: t.updatedAt.toISOString() } };
        }
        // Compatibility: English typed into the old fields before translations existed counts as human-written.
        if (language.code === "en" && video.titleEn) {
          return { language, translation: { id: "", title: video.titleEn, slug: video.slug, description: video.descriptionEn, subtitleUrl: video.subtitleUrlEn, status: "EDITED" as const, reviewedAt: null, updatedAt: video.updatedAt.toISOString() } };
        }
        return { language, translation: null };
      }),
    });
  } catch (error) {
    return fail(error as AppError);
  }
}

async function isSlugTaken(language: string, slug: string, videoId: string, ctx: AppContext): Promise<boolean> {
  const [t, h] = await Promise.all([
    ctx.prisma.videoTranslation.count({ where: { language, slug, videoId: { not: videoId } } }),
    ctx.prisma.videoSlugHistory.count({ where: { language, slug, videoId: { not: videoId } } }),
  ]);
  return t + h > 0;
}

export type SaveTranslationInput = { videoId: string; language: string; title: string; description?: string | null; slug?: string | null };

/** A person writes or corrects a language: status EDITED, reviewed now by the acting admin. */
export async function saveFilmTranslation(input: SaveTranslationInput, ctx: AppContext): Promise<UseCaseResult<{ slug: string }, AppError>> {
  try {
    if (!isTranslationLanguage(input.language)) return fail(new AppError("Nieobsługiwany język.", 400, "LANGUAGE_UNSUPPORTED"));
    const denied = languageDenied(ctx, input.language);
    if (denied) return fail(denied);
    const title = input.title.trim();
    if (!title || title.length > 200) return fail(new AppError("Tytuł: od 1 do 200 znaków.", 400, "TRANSLATION_INVALID_TITLE"));
    const description = input.description?.trim() ? input.description.trim().slice(0, 5000) : null;
    const video = await requireFilm(input.videoId, ctx);
    const existing = await ctx.prisma.videoTranslation.findUnique({ where: { videoId_language: { videoId: video.id, language: input.language } } });

    let slug: string;
    const typed = input.slug?.trim();
    if (typed) {
      if (!isValidSlug(typed)) return fail(new AppError("Adres: małe litery, cyfry i pojedyncze myślniki, do 80 znaków.", 400, "TRANSLATION_INVALID_SLUG"));
      if (await isSlugTaken(input.language, typed, video.id, ctx)) return fail(new AppError("Ten adres w tym języku ma już inny film.", 409, "TRANSLATION_SLUG_CONFLICT"));
      slug = typed;
    } else if (existing) {
      slug = existing.slug;
    } else {
      // Generated from the translated title; collisions get -2, -3 (taken set read once, small table).
      const taken = new Set(
        (await ctx.prisma.videoTranslation.findMany({ where: { language: input.language, videoId: { not: video.id } }, select: { slug: true } })).map((r) => r.slug)
          .concat((await ctx.prisma.videoSlugHistory.findMany({ where: { language: input.language, videoId: { not: video.id } }, select: { slug: true } })).map((r) => r.slug)),
      );
      slug = uniqueSlug(title, input.language, (s) => taken.has(s), video.slug);
    }

    const now = new Date();
    await ctx.db.writeTransaction(async (tx) => {
      if (existing && existing.slug !== slug) {
        await tx.videoSlugHistory.createMany({ data: [{ videoId: video.id, language: input.language, slug: existing.slug }], skipDuplicates: true });
      }
      await tx.videoTranslation.upsert({
        where: { videoId_language: { videoId: video.id, language: input.language } },
        create: { videoId: video.id, language: input.language, title, slug, description, status: "EDITED", reviewedAt: now, reviewedById: actorId(ctx), subtitleUrl: input.language === "en" ? video.subtitleUrlEn : null },
        update: { title, slug, description, status: "EDITED", reviewedAt: now, reviewedById: actorId(ctx) },
      });
    });
    if (input.language === "en") {
      // The site reads these columns today; keep them equal to the English translation.
      const synced = await updateAdminVideo({ id: video.id, titleEn: title, descriptionEn: description }, ctx);
      if (!synced.ok) return fail(synced.error as AppError);
    }
    await recordAuditEventSafe(ctx, { action: "VIDEO_TRANSLATION_SAVED", targetType: "Video", targetId: video.id, metadata: { language: input.language, slugChanged: !!existing && existing.slug !== slug } });
    return ok({ slug });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") return fail(new AppError("Ten adres w tym języku ma już inny film.", 409, "TRANSLATION_SLUG_CONFLICT"));
    return fail(error as AppError);
  }
}

/** Approving a machine draft as is. Already human-written versions stay EDITED. */
export async function approveFilmTranslations(input: { videoId: string; language?: string }, ctx: AppContext): Promise<UseCaseResult<{ approved: number }, AppError>> {
  try {
    if (input.language && !isTranslationLanguage(input.language)) return fail(new AppError("Nieobsługiwany język.", 400, "LANGUAGE_UNSUPPORTED"));
    if (ctx.allowedLanguages) return fail(new AppError("Zatwierdza właściciel kanału, nie tłumacz.", 403, "APPROVAL_NOT_GRANTED"));
    const video = await requireFilm(input.videoId, ctx);
    const res = await ctx.prisma.videoTranslation.updateMany({
      where: { videoId: video.id, status: "AI_DRAFT", ...(input.language ? { language: input.language } : {}) },
      data: { status: "APPROVED", reviewedAt: new Date(), reviewedById: actorId(ctx) },
    });
    await recordAuditEventSafe(ctx, { action: "VIDEO_TRANSLATION_APPROVED", targetType: "Video", targetId: video.id, metadata: { language: input.language ?? "all", count: res.count } });
    return ok({ approved: res.count });
  } catch (error) {
    return fail(error as AppError);
  }
}

/** Public subtitle URLs of every translation of a film (for clean-up when the film is deleted). */
export async function translationSubtitleUrls(videoId: string, ctx: AppContext): Promise<string[]> {
  const rows = await ctx.prisma.videoTranslation.findMany({ where: { videoId, subtitleUrl: { not: null } }, select: { subtitleUrl: true } });
  return rows.map((r) => r.subtitleUrl!).filter(Boolean);
}

/** Sets or clears the subtitle file of one translation (languages other than pl; en also mirrors the Video column elsewhere). */
export async function setTranslationSubtitle(input: { videoId: string; language: string; url: string | null }, ctx: AppContext): Promise<UseCaseResult<{ previous: string | null }, AppError>> {
  const row = await ctx.prisma.videoTranslation.findUnique({ where: { videoId_language: { videoId: input.videoId, language: input.language } } });
  if (!row) {
    if (input.language === "en") return ok({ previous: null });
    return fail(new AppError("Najpierw zapisz tytuł w tym języku, potem dodaj napisy.", 409, "TRANSLATION_MISSING"));
  }
  await ctx.prisma.videoTranslation.update({ where: { id: row.id }, data: { subtitleUrl: input.url } });
  return ok({ previous: row.subtitleUrl });
}


export type QueueItem = { slug: string; title: string; languages: { code: string; status: TranslationStatus | null }[] };

/**
 * "Do przetłumaczenia" for a translator: films of the channel (not archived) with the state of each language
 * the account may write; films with a missing or machine-drafted language first.
 */
export async function listTranslationQueue(languages: readonly string[], ctx: AppContext): Promise<QueueItem[]> {
  const channel = await MainChannelService.getRequired(ctx);
  const codes = TRANSLATION_LANGUAGES.map((l) => l.code).filter((c) => languages.includes(c));
  if (!codes.length) return [];
  const videos = await ctx.prisma.video.findMany({
    where: { creatorId: channel.id, status: { in: ["PUBLISHED", "DRAFT"] } },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { id: true, slug: true, title: true, titleEn: true },
  });
  const rows = await ctx.prisma.videoTranslation.findMany({ where: { videoId: { in: videos.map((v) => v.id) }, language: { in: codes } }, select: { videoId: true, language: true, status: true } });
  const items = videos.map((v) => ({
    slug: v.slug,
    title: v.title,
    languages: codes.map((code) => {
      const row = rows.find((r) => r.videoId === v.id && r.language === code);
      // English typed into the old fields before translations existed counts as human-written.
      return { code, status: (row?.status ?? (code === "en" && v.titleEn ? "EDITED" : null)) as TranslationStatus | null };
    }),
  }));
  const todo = (i: QueueItem) => i.languages.filter((l) => l.status === null || l.status === "AI_DRAFT").length;
  return items.sort((a, b) => todo(b) - todo(a));
}
