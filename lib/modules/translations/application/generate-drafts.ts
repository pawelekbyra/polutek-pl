/**
 * "Generuj szkice AI": machine drafts of title and description for the languages a film lacks. A draft is an
 * AI_DRAFT row; it never overwrites a human-written or approved version, never goes live on its own (the site
 * keeps reading Video.titleEn until a person saves or approves), and every run is audited with counts.
 */
import type { AppContext } from "@/lib/modules/shared/app-context";
import { AppError } from "@/lib/modules/shared/app-error";
import { fail, ok, type UseCaseResult } from "@/lib/modules/shared/result";
import { recordAuditEventSafe } from "@/lib/modules/audit";
import { MainChannelService } from "@/lib/modules/channel";
import { DraftProviderError, draftAiStatus, type DraftEnv, type DraftProviderLang, type TranslationDraftProvider } from "../domain/draft-provider";
import { TRANSLATION_LANGUAGES, isTranslationLanguage } from "../domain/languages";
import { uniqueSlug } from "../domain/slug";

export type DraftResult = { created: string[]; skipped: { language: string; reason: string }[]; stoppedBy: "quota" | "unavailable" | null; provider: string };

const MAX_CHARS = 6000;

export async function generateTranslationDrafts(
  input: { videoId: string; languages?: string[] },
  ctx: AppContext,
  provider: TranslationDraftProvider,
  env: DraftEnv = process.env,
): Promise<UseCaseResult<DraftResult, AppError>> {
  if (ctx.actor.type !== "admin" || ctx.allowedLanguages) return fail(new AppError("Szkice AI generuje właściciel kanału.", 403, "FORBIDDEN"));
  const status = draftAiStatus(env);
  if (!status.enabled) return fail(new AppError(status.reason ?? "Generowanie szkiców jest wyłączone.", 409, "AI_DISABLED"));
  const targets = (input.languages?.length ? input.languages : TRANSLATION_LANGUAGES.map((l) => l.code)).filter(isTranslationLanguage);
  if (!targets.length) return fail(new AppError("Wybierz co najmniej jeden obsługiwany język.", 400, "LANGUAGE_UNSUPPORTED"));

  const channel = await MainChannelService.getRequired(ctx);
  const video = await ctx.prisma.video.findFirst({ where: { creatorId: channel.id, OR: [{ id: input.videoId }, { slug: input.videoId }] }, select: { id: true, slug: true, title: true, description: true, titleEn: true } });
  if (!video) return fail(new AppError("Ten film już nie istnieje.", 404, "VIDEO_NOT_FOUND"));
  if (video.title.length + (video.description?.length ?? 0) > MAX_CHARS) return fail(new AppError("Tytuł i opis są za długie na szkic automatyczny (limit 6000 znaków).", 400, "AI_TEXT_TOO_LONG"));

  const existing = await ctx.prisma.videoTranslation.findMany({ where: { videoId: video.id } });
  const result: DraftResult = { created: [], skipped: [], stoppedBy: null, provider: provider.name };

  for (const language of targets) {
    const row = existing.find((r) => r.language === language);
    if (row && row.status !== "AI_DRAFT") {
      result.skipped.push({ language, reason: "ma już wersję napisaną lub zatwierdzoną przez człowieka" });
      continue;
    }
    if (!row && language === "en" && video.titleEn) {
      result.skipped.push({ language, reason: "angielski wpisany ręcznie w polach EN filmu" });
      continue;
    }
    try {
      const title = (await provider.translate({ text: video.title, from: "pl", to: language })).slice(0, 200);
      const description = video.description?.trim() ? (await provider.translate({ text: video.description, from: "pl", to: language })).slice(0, 5000) : null;
      const taken = new Set([
        ...(await ctx.prisma.videoTranslation.findMany({ where: { language, videoId: { not: video.id } }, select: { slug: true } })).map((r) => r.slug),
        ...(await ctx.prisma.videoSlugHistory.findMany({ where: { language, videoId: { not: video.id } }, select: { slug: true } })).map((r) => r.slug),
      ]);
      const slug = row?.slug ?? uniqueSlug(title, language, (s) => taken.has(s), video.slug);
      await ctx.prisma.videoTranslation.upsert({
        where: { videoId_language: { videoId: video.id, language } },
        create: { videoId: video.id, language, title, slug, description, status: "AI_DRAFT" },
        update: { title, description, status: "AI_DRAFT", reviewedAt: null, reviewedById: null },
      });
      result.created.push(language);
    } catch (error) {
      if (error instanceof DraftProviderError && (error.kind === "quota" || error.kind === "unavailable")) {
        result.stoppedBy = error.kind;
        result.skipped.push({ language, reason: error.message });
        break;
      }
      result.skipped.push({ language, reason: "dostawca zwrócił niepoprawną odpowiedź" });
    }
  }
  await recordAuditEventSafe(ctx, { action: "TRANSLATION_AI_DRAFTS_GENERATED", targetType: "Video", targetId: video.id, metadata: { provider: provider.name, created: result.created, skipped: result.skipped.map((s) => s.language), stoppedBy: result.stoppedBy } });
  return ok(result);
}

export type { DraftProviderLang };
