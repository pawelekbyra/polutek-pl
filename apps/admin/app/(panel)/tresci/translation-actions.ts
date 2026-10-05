"use server";
/** Writes of the "Tłumaczenia" screen: save one language, approve one or all machine drafts. */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { approveFilmTranslations, saveFilmTranslation } from "@/lib/modules/translations";
import { openGate } from "@admin/lib/actions/gate";
import { RATE } from "@admin/lib/actions/rate-limit";
import { errorMessage, zodFieldErrors, type ActionResult } from "@admin/lib/actions/panel";
import { draftAiStatus, createWorkersAiProvider, generateTranslationDrafts, type DraftResult } from "@/lib/modules/translations";

const MESSAGES: Record<string, string> = {
  TRANSLATION_SLUG_CONFLICT: "Ten adres w tym języku ma już inny film.",
  LANGUAGE_NOT_GRANTED: "Nie masz uprawnień do tego języka.",
  TRANSLATION_INVALID_SLUG: "Adres: małe litery, cyfry i pojedyncze myślniki, do 80 znaków.",
};

const saveSchema = z
  .object({
    videoId: z.string().min(1),
    filmSlug: z.string().min(1),
    language: z.string().min(2).max(8),
    title: z.string().trim().min(1, "Podaj tytuł.").max(200, "Najwyżej 200 znaków."),
    slug: z.string().trim().max(80, "Najwyżej 80 znaków.").optional(),
    description: z.string().max(5000, "Najwyżej 5000 znaków.").optional(),
  })
  .strict();

export async function saveTranslationAction(_prev: ActionResult<{ slug: string }> | null, fd: FormData): Promise<ActionResult<{ slug: string }>> {
  // Owner and translator may save; a translator's languages are enforced by the use case (ctx.allowedLanguages).
  const gate = await openGate({ path: "/tresci", rate: RATE.settings, roles: ["OWNER", "TRANSLATOR"] });
  if (!gate.ok) return gate.result;
  const raw = Object.fromEntries(["videoId", "filmSlug", "language", "title", "slug", "description"].flatMap((k) => (fd.get(k) === null ? [] : [[k, String(fd.get(k))]])));
  const parsed = saveSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Popraw zaznaczone pola.", fieldErrors: zodFieldErrors(parsed.error.issues) };
  const { videoId, filmSlug, ...rest } = parsed.data;
  const res = await saveFilmTranslation({ videoId, ...rest }, gate.ctx);
  if (!res.ok) {
    const code = (res.error as { code?: string }).code;
    const message = (code && MESSAGES[code]) || errorMessage(res.error).message;
    return { ok: false, code, message, fieldErrors: code?.includes("SLUG") ? { slug: message } : code === "TRANSLATION_INVALID_TITLE" ? { title: message } : undefined };
  }
  revalidatePath(`/tresci/${filmSlug}/tlumaczenia`);
  revalidatePath(`/tresci/${filmSlug}`);
  revalidatePath(`/tlumaczenia/${filmSlug}`);
  revalidatePath("/tlumaczenia");
  return { ok: true, message: "Zapisano tłumaczenie.", data: { slug: res.data.slug } };
}

export async function approveTranslationsAction(input: { videoId: string; filmSlug: string; language?: string }): Promise<ActionResult> {
  const gate = await openGate({ path: "/tresci", rate: RATE.settings });
  if (!gate.ok) return gate.result;
  const res = await approveFilmTranslations({ videoId: input.videoId, language: input.language }, gate.ctx);
  if (!res.ok) return { ok: false, ...errorMessage(res.error) };
  revalidatePath(`/tresci/${input.filmSlug}/tlumaczenia`);
  return { ok: true, message: res.data.approved ? `Zatwierdzono: ${res.data.approved}.` : "Nie było szkiców do zatwierdzenia." };
}

const draftsSchema = z.object({ videoId: z.string().min(1).max(100), filmSlug: z.string().min(1).max(200), languages: z.array(z.string().min(2).max(8)).max(8).optional() }).strict();

/** "Generuj szkice AI": owner only, off unless the feature flag and credentials are set; never overwrites human text. */
export async function generateDraftsAction(input: { videoId: string; filmSlug: string; languages?: string[] }): Promise<ActionResult<DraftResult>> {
  const gate = await openGate({ path: "/tresci", rate: RATE.ai });
  if (!gate.ok) return gate.result;
  const parsed = draftsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Niepoprawne żądanie." };
  const status = draftAiStatus();
  if (!status.enabled) return { ok: false, code: "AI_DISABLED", message: status.reason ?? "Generowanie szkiców jest wyłączone." };
  const res = await generateTranslationDrafts({ videoId: parsed.data.videoId, languages: parsed.data.languages }, gate.ctx, createWorkersAiProvider());
  if (!res.ok) return { ok: false, ...errorMessage(res.error), message: res.error.message };
  revalidatePath(`/tresci/${parsed.data.filmSlug}/tlumaczenia`);
  const d = res.data;
  const note = d.stoppedBy === "quota" ? " Dzienny limit Workers AI wyczerpany: reszta jutro (po 00:00 UTC)." : d.stoppedBy ? " Dostawca przestał odpowiadać." : "";
  return { ok: true, message: d.created.length ? `Szkice AI: ${d.created.join(", ")} (do zatwierdzenia).${note}` : `Nie powstał żaden szkic.${note}`, data: d };
}
