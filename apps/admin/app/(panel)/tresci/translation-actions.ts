"use server";
/** Writes of the "Tłumaczenia" screen: save one language, approve one or all machine drafts. */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { approveFilmTranslations, saveFilmTranslation } from "@/lib/modules/translations";
import { requireAdmin } from "@admin/lib/auth/guard";
import { isDevFixturesEnabled } from "@admin/lib/config";
import { errorMessage, panelContext, sampleDataRefusal, zodFieldErrors, type ActionResult } from "@admin/lib/actions/panel";

const MESSAGES: Record<string, string> = {
  TRANSLATION_SLUG_CONFLICT: "Ten adres w tym języku ma już inny film.",
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
  const viewer = await requireAdmin("/tresci");
  if (isDevFixturesEnabled()) return sampleDataRefusal();
  const raw = Object.fromEntries(["videoId", "filmSlug", "language", "title", "slug", "description"].flatMap((k) => (fd.get(k) === null ? [] : [[k, String(fd.get(k))]])));
  const parsed = saveSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Popraw zaznaczone pola.", fieldErrors: zodFieldErrors(parsed.error.issues) };
  const { videoId, filmSlug, ...rest } = parsed.data;
  const res = await saveFilmTranslation({ videoId, ...rest }, await panelContext(viewer));
  if (!res.ok) {
    const code = (res.error as { code?: string }).code;
    const message = (code && MESSAGES[code]) || errorMessage(res.error).message;
    return { ok: false, code, message, fieldErrors: code?.includes("SLUG") ? { slug: message } : code === "TRANSLATION_INVALID_TITLE" ? { title: message } : undefined };
  }
  revalidatePath(`/tresci/${filmSlug}/tlumaczenia`);
  revalidatePath(`/tresci/${filmSlug}`);
  return { ok: true, message: "Zapisano tłumaczenie.", data: { slug: res.data.slug } };
}

export async function approveTranslationsAction(input: { videoId: string; filmSlug: string; language?: string }): Promise<ActionResult> {
  const viewer = await requireAdmin("/tresci");
  if (isDevFixturesEnabled()) return sampleDataRefusal();
  const res = await approveFilmTranslations({ videoId: input.videoId, language: input.language }, await panelContext(viewer));
  if (!res.ok) return { ok: false, ...errorMessage(res.error) };
  revalidatePath(`/tresci/${input.filmSlug}/tlumaczenia`);
  return { ok: true, message: res.data.approved ? `Zatwierdzono: ${res.data.approved}.` : "Nie było szkiców do zatwierdzenia." };
}
