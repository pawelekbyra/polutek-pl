"use server";
/**
 * Writes of "Ustawienia": channel texts, channel account, subscriber recount, default thumbnail removal,
 * minimum tip per currency, alert thresholds. Gate (session, rate limit, step-up where it matters) ->
 * zod .strict -> use case (audit with before/after lives there) -> revalidate.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { SUPPORTED_CURRENCIES, MAX_PAYMENT_BY_CURRENCY } from "@/lib/constants";
import { changeChannelOwner, findChannelOwnerCandidates, resyncSubscribers, updateAdminChannelSettings, type ChannelOwnerCandidate } from "@/lib/modules/channel";
import { removeDefaultThumbnail } from "@/lib/modules/admin-content";
import { updatePaymentSettings } from "@/lib/modules/payments";
import { resetAlertThresholds, saveAlertThresholds, THRESHOLD_FIELDS, ThresholdValidationError, type LimitThresholds } from "@/lib/modules/admin-overview";
import { openGate } from "@admin/lib/actions/gate";
import { RATE } from "@admin/lib/actions/rate-limit";
import { errorMessage, zodFieldErrors, type ActionResult } from "@admin/lib/actions/panel";

const channelSchema = z
  .object({
    name: z.string().trim().min(1, "Podaj nazwę kanału.").max(80, "Najwyżej 80 znaków."),
    bio: z.string().trim().max(1000, "Najwyżej 1000 znaków.").transform((v) => (v === "" ? null : v)),
  })
  .strict();

export async function saveChannelAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const gate = await openGate({ path: "/ustawienia", rate: RATE.settings });
  if (!gate.ok) return gate.result;
  const parsed = channelSchema.safeParse({ name: String(fd.get("name") ?? ""), bio: String(fd.get("bio") ?? "") });
  if (!parsed.success) return { ok: false, message: "Popraw zaznaczone pola.", fieldErrors: zodFieldErrors(parsed.error.issues) };
  try {
    await updateAdminChannelSettings(gate.ctx, parsed.data);
  } catch (error) {
    return { ok: false, ...errorMessage(error) };
  }
  revalidatePath("/ustawienia");
  return { ok: true, message: "Zapisano ustawienia kanału." };
}

export async function resyncSubscribersAction(): Promise<ActionResult<{ count: number }>> {
  const gate = await openGate({ path: "/ustawienia", rate: RATE.sync });
  if (!gate.ok) return gate.result;
  const res = await resyncSubscribers(gate.ctx);
  if (!res.ok) return { ok: false, ...errorMessage(res.error) };
  revalidatePath("/ustawienia");
  const count = res.data.updated[0]?.subscribersCount ?? 0;
  return { ok: true, message: `Przeliczono subskrybentów: ${count}.`, data: { count } };
}

export async function removeDefaultThumbnailAction(): Promise<ActionResult> {
  const gate = await openGate({ path: "/ustawienia", rate: RATE.upload });
  if (!gate.ok) return gate.result;
  const res = await removeDefaultThumbnail(gate.ctx);
  if (!res.ok) return { ok: false, ...errorMessage(res.error) };
  revalidatePath("/ustawienia");
  return { ok: true, message: res.data.deleted ? "Domyślna miniatura usunięta." : "Nie było domyślnej miniatury." };
}

// ---------------------------------------------------------------- channel account (step-up)

const lookupSchema = z.object({ query: z.string().trim().min(3).max(120) }).strict();

export async function lookupChannelOwnerAction(input: { query: string }): Promise<ActionResult<{ candidates: ChannelOwnerCandidate[] }>> {
  const gate = await openGate({ path: "/ustawienia", rate: RATE.sync });
  if (!gate.ok) return gate.result;
  const parsed = lookupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Wpisz co najmniej 3 znaki (e-mail albo pseudonim)." };
  const candidates = await findChannelOwnerCandidates(gate.ctx, parsed.data.query);
  return { ok: true, data: { candidates } };
}

const ownerSchema = z.object({ userId: z.string().min(1).max(100), typedEmail: z.string().trim().min(3).max(200), reason: z.string().trim().min(3, "Podaj powód (co najmniej 3 znaki).").max(300) }).strict();

export async function changeChannelOwnerAction(input: { userId: string; typedEmail: string; reason: string }): Promise<ActionResult> {
  const gate = await openGate({ path: "/ustawienia", rate: RATE.money, stepUp: true });
  if (!gate.ok) return gate.result;
  const parsed = ownerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Popraw zaznaczone pola.", fieldErrors: zodFieldErrors(parsed.error.issues) };
  // Typed confirmation: the e-mail of the chosen account must be retyped (checked against the database, not the form).
  const [candidate] = (await findChannelOwnerCandidates(gate.ctx, parsed.data.typedEmail)).filter((c) => c.id === parsed.data.userId);
  if (!candidate || candidate.email.toLowerCase() !== parsed.data.typedEmail.toLowerCase()) {
    return { ok: false, code: "TYPED_MISMATCH", message: "Wpisany e-mail nie zgadza się z wybranym kontem.", fieldErrors: { typedEmail: "Wpisz dokładnie e-mail wybranego konta." } };
  }
  const res = await changeChannelOwner(gate.ctx, { userId: parsed.data.userId, reason: parsed.data.reason });
  if (!res.ok) return { ok: false, ...errorMessage(res.error) };
  revalidatePath("/ustawienia");
  return { ok: true, message: `Konto kanału: ${res.data.owner.email}.` };
}

// ---------------------------------------------------------------- payments

const money = (currency: (typeof SUPPORTED_CURRENCIES)[number]) =>
  z
    .string()
    .trim()
    .transform((v) => Number(v.replace(/\s/g, "").replace(",", ".")))
    .pipe(z.number({ invalid_type_error: "Podaj kwotę, np. 10 albo 10,50." }).finite("Podaj kwotę, np. 10 albo 10,50.").min(1, "Minimum to 1.").max(MAX_PAYMENT_BY_CURRENCY[currency], `Nie więcej niż maksimum ${MAX_PAYMENT_BY_CURRENCY[currency]}.`))
    .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6, "Najwyżej dwa miejsca po przecinku.");

const paymentsSchema = z.object(Object.fromEntries(SUPPORTED_CURRENCIES.map((c) => [c, money(c)])) as Record<(typeof SUPPORTED_CURRENCIES)[number], ReturnType<typeof money>>).strict();

export async function savePaymentLimitsAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const gate = await openGate({ path: "/ustawienia?tab=platnosci", rate: RATE.settings });
  if (!gate.ok) return gate.result;
  const parsed = paymentsSchema.safeParse(Object.fromEntries(SUPPORTED_CURRENCIES.map((c) => [c, String(fd.get(c) ?? "")])));
  if (!parsed.success) return { ok: false, message: "Popraw zaznaczone kwoty.", fieldErrors: zodFieldErrors(parsed.error.issues) };
  const res = await updatePaymentSettings({ limits: SUPPORTED_CURRENCIES.map((c) => ({ currency: c, minAmount: parsed.data[c] })) }, gate.ctx);
  if (!res.ok) return { ok: false, ...errorMessage(res.error) };
  revalidatePath("/ustawienia");
  return { ok: true, message: "Zapisano minimalne kwoty napiwku. Bramka na stronie pokazuje je od razu." };
}

// ---------------------------------------------------------------- alert thresholds

const pct = z.string().trim().regex(/^\d{1,3}$/, "Liczba całkowita od 1 do 100.").transform(Number);
const thresholdsSchema = z.object(Object.fromEntries(THRESHOLD_FIELDS.flatMap((f) => [[`${f.key}.warnAt`, pct], [`${f.key}.critAt`, pct]]))).strict();

export async function saveThresholdsAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const gate = await openGate({ path: "/ustawienia?tab=panel", rate: RATE.settings });
  if (!gate.ok) return gate.result;
  const raw = Object.fromEntries(THRESHOLD_FIELDS.flatMap((f) => [`${f.key}.warnAt`, `${f.key}.critAt`]).map((k) => [k, String(fd.get(k) ?? "")]));
  const parsed = thresholdsSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Popraw zaznaczone progi.", fieldErrors: zodFieldErrors(parsed.error.issues) };
  const v = parsed.data as Record<string, number>;
  const limits = Object.fromEntries(THRESHOLD_FIELDS.map((f) => [f.key, { warnAt: v[`${f.key}.warnAt`], critAt: v[`${f.key}.critAt`] }])) as LimitThresholds;
  const res = await saveAlertThresholds(gate.ctx, limits);
  if (!res.ok) {
    if (res.error instanceof ThresholdValidationError) return { ok: false, message: res.error.message, fieldErrors: res.error.fieldErrors };
    return { ok: false, ...errorMessage(res.error) };
  }
  revalidatePath("/ustawienia");
  revalidatePath("/");
  return { ok: true, message: "Zapisano progi alertów. Obowiązują od następnego odświeżenia." };
}

export async function resetThresholdsAction(): Promise<ActionResult> {
  const gate = await openGate({ path: "/ustawienia?tab=panel", rate: RATE.settings });
  if (!gate.ok) return gate.result;
  const res = await resetAlertThresholds(gate.ctx);
  if (!res.ok) return { ok: false, ...errorMessage(res.error) };
  revalidatePath("/ustawienia");
  revalidatePath("/");
  return { ok: true, message: res.data.reset ? "Przywrócono progi domyślne." : "Progi już są domyślne." };
}
