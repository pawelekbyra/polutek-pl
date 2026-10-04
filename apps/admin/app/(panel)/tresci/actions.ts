"use server";
/**
 * Writes of the "Treści" section. Each one: requireAdmin -> zod -> (step-up) -> use case -> revalidate.
 * Business rules (publication blockers, Hero, premiere, thumbnail sync, audit) live in the use cases.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  archiveAdminVideo,
  createAdminVideo,
  getAdminVideoById,
  getAdminVideoDiagnostics,
  publishAdminVideo,
  requestPublishAfterAssetReady,
  updateAdminVideo,
  VideoPolicy,
  type UpdateVideoInput,
} from "@/lib/modules/video";
import { cancelEncode, deleteSelfHlsAsset, enqueueEncode } from "@/lib/modules/video-pipeline";
import { deleteVideoWithStorage, removeVideoSubtitle, saveChannelLayout, slugify } from "@/lib/modules/admin-content";
import { hasFreshStepUp, requireAdmin } from "@admin/lib/auth/guard";
import { isDevFixturesEnabled } from "@admin/lib/config";
import { dateToWarsawLocal, errorMessage, sampleDataRefusal, panelContext, warsawLocalToDate, zodFieldErrors, type ActionResult } from "@admin/lib/actions/panel";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const text = (max: number) => z.string().trim().max(max, `Najwyżej ${max} znaków.`);
const optional = (max: number) => text(max).transform((v) => (v === "" ? null : v));

const baseFields = {
  title: text(200).min(1, "Podaj tytuł."),
  slug: text(80).regex(SLUG, "Tylko małe litery, cyfry i pojedyncze myślniki."),
  titleEn: optional(200),
  description: optional(5000),
  descriptionEn: optional(5000),
  tier: z.enum(["PUBLIC", "LOGGED_IN"], { errorMap: () => ({ message: "Wybierz poziom dostępu." }) }),
};

const fieldsOf = (fd: FormData, keys: string[]) => Object.fromEntries(keys.map((k) => [k, String(fd.get(k) ?? "")]));

function revalidateFilm(slug?: string) {
  revalidatePath("/tresci");
  if (slug) {
    revalidatePath(`/tresci/${slug}`);
    revalidatePath(`/tresci/${slug}/edycja`);
  }
  revalidatePath("/");
}

// ---------------------------------------------------------------- create

export async function createFilmAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const viewer = await requireAdmin("/tresci/nowy");
  if (isDevFixturesEnabled()) return sampleDataRefusal();
  const raw = fieldsOf(fd, ["title", "slug", "titleEn", "description", "descriptionEn", "tier"]);
  if (!raw.slug) raw.slug = slugify(raw.title);
  const parsed = z.object(baseFields).strict().safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Popraw zaznaczone pola.", fieldErrors: zodFieldErrors(parsed.error.issues) };
  const ctx = await panelContext(viewer);
  const created = await createAdminVideo({ ...parsed.data, status: "DRAFT" }, ctx);
  if (!created.ok) {
    const err = errorMessage(created.error);
    return { ok: false, ...err, fieldErrors: err.code === "VIDEO_SLUG_CONFLICT" ? { slug: err.message } : undefined };
  }
  revalidateFilm();
  redirect(`/tresci/${created.data.slug}/edycja?nowy=1#oryginal`);
}

// ---------------------------------------------------------------- edit (one form, one save)

const editSchema = z
  .object({
    ...baseFields,
    id: z.string().min(1),
    expectedUpdatedAt: z.string().min(1),
    when: z.enum(["keep", "draft", "now", "premiere"]),
    premiereAt: z.string().optional(),
    fundMode: z.enum(["off", "manual", "goal"]),
    fundPercent: z.string().optional(),
    fundGoal: z.string().optional(),
    fundCurrency: z.enum(["PLN", "EUR", "USD", "CHF", "GBP"]).optional(),
    fundSince: z.string().optional(),
    showInSidebar: z.enum(["on"]).optional(),
    isMainFeatured: z.enum(["on"]).optional(),
  })
  .strict();

const EDIT_KEYS = ["id", "expectedUpdatedAt", "title", "slug", "titleEn", "description", "descriptionEn", "tier", "when", "premiereAt", "fundMode", "fundPercent", "fundGoal", "fundCurrency", "fundSince", "showInSidebar", "isMainFeatured"];

export async function saveFilmAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const viewer = await requireAdmin("/tresci");
  if (isDevFixturesEnabled()) return sampleDataRefusal();
  const raw: Record<string, string | undefined> = {};
  for (const k of EDIT_KEYS) {
    const v = fd.get(k);
    if (v !== null) raw[k] = String(v);
  }
  const parsed = editSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Popraw zaznaczone pola.", fieldErrors: zodFieldErrors(parsed.error.issues) };
  const f = parsed.data;
  const ctx = await panelContext(viewer);

  const current = await getAdminVideoById({ idOrSlug: f.id }, ctx);
  if (!current.ok) return { ok: false, ...errorMessage(current.error) };
  // Optimistic lock: someone (or another tab) saved after this form was opened.
  if (new Date(current.data.updatedAt).toISOString() !== f.expectedUpdatedAt) {
    return { ok: false, code: "CONFLICT", message: "Film zmienił się od otwarcia formularza (inna karta albo stary panel). Odśwież stronę; Twoje zmiany nie zostały zapisane." };
  }

  const fieldErrors: Record<string, string> = {};
  const update: UpdateVideoInput = { id: f.id, title: f.title, slug: f.slug, titleEn: f.titleEn, description: f.description, descriptionEn: f.descriptionEn, tier: f.tier };

  // Fundraising bar: manual percent wins over the goal; "off" clears both.
  if (f.fundMode === "off") {
    Object.assign(update, { fundraisingManualPercent: null, fundraisingGoalMinor: null, fundraisingGoalCurrency: null, fundraisingStartAt: null });
  } else if (f.fundMode === "manual") {
    const pct = Number(f.fundPercent);
    if (!Number.isInteger(pct) || pct < 0 || pct > 100) fieldErrors.fundPercent = "Liczba całkowita od 0 do 100.";
    else update.fundraisingManualPercent = pct;
  } else {
    const amount = Number(String(f.fundGoal ?? "").replace(/\s/g, "").replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000) fieldErrors.fundGoal = "Podaj kwotę celu, np. 2000.";
    const since = f.fundSince ? new Date(`${f.fundSince}T00:00:00Z`) : null;
    if (f.fundSince && (!since || Number.isNaN(since.getTime()))) fieldErrors.fundSince = "Niepoprawna data.";
    if (!fieldErrors.fundGoal) {
      Object.assign(update, { fundraisingManualPercent: null, fundraisingGoalMinor: Math.round(amount * 100), fundraisingGoalCurrency: f.fundCurrency ?? "PLN", fundraisingStartAt: since });
    }
  }

  // Publication. "premiere" stores premiereAt and publishes (the video stays "upcoming" until then).
  const isPublished = current.data.status === "PUBLISHED";
  let publishNow = false;
  if (f.when === "premiere") {
    const at = f.premiereAt ? warsawLocalToDate(f.premiereAt) : null;
    if (!at) fieldErrors.premiereAt = "Podaj datę i godzinę premiery.";
    else {
      // Resubmitting the stored premiere (even a past one) is not a change; only a new value must be in the future.
      if (f.premiereAt !== dateToWarsawLocal(current.data.premiereAt)) update.premiereAt = at;
      if (!isPublished) publishNow = true;
    }
  } else if (f.when === "now") {
    if (current.data.premiereAt) update.premiereAt = null;
    if (!isPublished) publishNow = true;
  } else if (f.when === "draft" && !isPublished && current.data.premiereAt) {
    update.premiereAt = null;
  }
  if (Object.keys(fieldErrors).length) return { ok: false, message: "Popraw zaznaczone pola.", fieldErrors };

  // Pre-flight BEFORE saving anything (ADM-33): publishing is refused as a whole, never half-saved.
  let deferPublish = false;
  if (publishNow) {
    const diag = await getAdminVideoDiagnostics({ videoId: f.id }, ctx);
    const blockers = diag.ok ? diag.data.filter((i) => i.severity === "ERROR" && i.code?.startsWith("VIDEO_PUBLICATION_")) : [];
    const onlyEncoding = blockers.length > 0 && blockers.every((b) => !!b.code && VideoPolicy.isAssetReadinessBlocker(b.code));
    if (blockers.length && !onlyEncoding) {
      return { ok: false, code: "NOT_READY", message: `Nie można opublikować: ${blockers.map((b) => b.message.replace(/^Publikacja zablokowana: /, "")).join(" ")}` };
    }
    // "Publish when encoding finishes": the worker publishes automatically once HLS is READY.
    deferPublish = onlyEncoding;
    if (!deferPublish) update.status = "PUBLISHED";
  }

  // Exposure applies to published films only (the use case refuses it for drafts).
  if (isPublished || update.status === "PUBLISHED") {
    update.showInSidebar = f.showInSidebar === "on";
    update.isMainFeatured = f.isMainFeatured === "on";
  }

  const saved = await updateAdminVideo(update, ctx);
  if (!saved.ok) {
    const err = errorMessage(saved.error);
    return { ok: false, ...err, fieldErrors: err.code === "VIDEO_SLUG_CONFLICT" ? { slug: err.message } : err.code === "VIDEO_INVALID_PREMIERE" ? { premiereAt: err.message } : undefined };
  }
  if (deferPublish) await requestPublishAfterAssetReady(f.id, ctx);
  revalidateFilm(saved.data.slug);
  if (saved.data.slug !== current.data.slug) redirect(`/tresci/${saved.data.slug}/edycja?zapisano=1`);
  return { ok: true, message: deferPublish ? "Zapisano. Film opublikuje się sam, gdy kodowanie się skończy." : "Zapisano zmiany filmu." };
}

// ---------------------------------------------------------------- status

const statusSchema = z.object({ id: z.string().min(1), op: z.enum(["publish", "unpublish", "archive", "restore", "duplicate"]) }).strict();

export async function filmStatusAction(input: { id: string; op: "publish" | "unpublish" | "archive" | "restore" | "duplicate" }): Promise<ActionResult<{ slug?: string }>> {
  const viewer = await requireAdmin("/tresci");
  if (isDevFixturesEnabled()) return sampleDataRefusal();
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Niepoprawne żądanie." };
  const ctx = await panelContext(viewer);
  const { id, op } = parsed.data;
  if (op === "duplicate") {
    const src = await getAdminVideoById({ idOrSlug: id }, ctx);
    if (!src.ok) return { ok: false, ...errorMessage(src.error) };
    const v = src.data;
    const copy = await createAdminVideo(
      { title: `${v.title} (kopia)`, slug: `${v.slug}-kopia-${Date.now().toString(36).slice(-4)}`, tier: v.tier === "PUBLIC" ? "PUBLIC" : "LOGGED_IN", titleEn: v.titleEn ?? null, description: v.description ?? null, descriptionEn: v.descriptionEn ?? null, status: "DRAFT" },
      ctx,
    );
    if (!copy.ok) return { ok: false, ...errorMessage(copy.error) };
    revalidateFilm();
    return { ok: true, message: "Utworzono kopię jako szkic (bez wideo; miniaturę i napisy wgraj w edycji).", data: { slug: copy.data.slug } };
  }
  const result =
    op === "publish"
      ? await publishAdminVideo(id, ctx)
      : op === "archive"
        ? await archiveAdminVideo(id, ctx)
        : await updateAdminVideo({ id, status: "DRAFT", ...(op === "unpublish" ? { isMainFeatured: false, showInSidebar: false } : {}) }, ctx);
  if (!result.ok) return { ok: false, ...errorMessage(result.error) };
  revalidateFilm((result.data as { slug?: string } | undefined)?.slug);
  const msg = { publish: "Opublikowano.", unpublish: "Cofnięto publikację: film jest szkicem.", archive: "Zarchiwizowano.", restore: "Przywrócono do szkiców." }[op];
  return { ok: true, message: msg };
}

// ---------------------------------------------------------------- delete (typed slug + step-up)

export async function deleteFilmAction(input: { id: string; typedSlug: string; returnTo: string }): Promise<ActionResult> {
  const viewer = await requireAdmin("/tresci");
  if (isDevFixturesEnabled()) return sampleDataRefusal();
  const ctx = await panelContext(viewer);
  const current = await getAdminVideoById({ idOrSlug: input.id }, ctx);
  if (!current.ok) return { ok: false, ...errorMessage(current.error) };
  if (input.typedSlug.trim() !== current.data.slug) return { ok: false, code: "TYPED_MISMATCH", message: "Wpisany adres nie zgadza się z adresem filmu." };
  if (!(await hasFreshStepUp())) return { ok: false, code: "STEP_UP_REQUIRED", message: "Najpierw potwierdź tożsamość (klucz dostępu albo TOTP)." };
  const result = await deleteVideoWithStorage(current.data.id, ctx);
  if (!result.ok) return { ok: false, ...errorMessage(result.error) };
  revalidateFilm();
  redirect("/tresci?usunieto=1");
}

// ---------------------------------------------------------------- encoding

export async function encodeAction(input: { videoId: string; op: "reencode" | "cancel" | "delete-asset"; jobId?: string; assetId?: string; slug: string }): Promise<ActionResult> {
  const viewer = await requireAdmin("/tresci");
  if (isDevFixturesEnabled()) return sampleDataRefusal();
  const ctx = await panelContext(viewer);
  const result =
    input.op === "reencode"
      ? await enqueueEncode({ videoId: input.videoId, auditAction: "VIDEO_REENCODE_REQUESTED" }, ctx)
      : input.op === "cancel" && input.jobId
        ? await cancelEncode({ videoId: input.videoId, jobId: input.jobId }, ctx)
        : input.op === "delete-asset" && input.assetId
          ? await deleteSelfHlsAsset({ videoId: input.videoId, assetId: input.assetId }, ctx)
          : null;
  if (!result) return { ok: false, message: "Niepoprawne żądanie." };
  if (!result.ok) return { ok: false, ...errorMessage(result.error) };
  revalidateFilm(input.slug);
  return { ok: true, message: { reencode: "Kodowanie w kolejce.", cancel: "Anulowanie zlecone: encoder przerwie przy następnym sygnale i posprząta pliki.", "delete-asset": "Wersja HLS usunięta." }[input.op] };
}

export async function removeSubtitleAction(input: { videoId: string; lang: string; slug: string }): Promise<ActionResult> {
  const viewer = await requireAdmin("/tresci");
  if (isDevFixturesEnabled()) return sampleDataRefusal();
  const result = await removeVideoSubtitle({ videoId: input.videoId, lang: String(input.lang).slice(0, 8) }, await panelContext(viewer));
  if (!result.ok) return { ok: false, ...errorMessage(result.error) };
  revalidateFilm(input.slug);
  return { ok: true, message: result.data.removed ? "Napisy usunięte." : "Ten film nie miał napisów." };
}

// ---------------------------------------------------------------- channel layout

const layoutSchema = z.object({ order: z.array(z.string().min(1)).max(500), hidden: z.array(z.string().min(1)).max(500), heroId: z.string().min(1).nullable() }).strict();

export async function saveLayoutAction(input: { order: string[]; hidden: string[]; heroId: string | null }): Promise<ActionResult> {
  const viewer = await requireAdmin("/tresci/uklad");
  if (isDevFixturesEnabled()) return sampleDataRefusal();
  const parsed = layoutSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Niepoprawny układ." };
  const result = await saveChannelLayout(parsed.data, await panelContext(viewer));
  if (!result.ok) return { ok: false, ...errorMessage(result.error) };
  revalidatePath("/tresci/uklad");
  revalidatePath("/tresci");
  return { ok: true, message: `Zapisano układ (${result.data.saved} filmów).` };
}
