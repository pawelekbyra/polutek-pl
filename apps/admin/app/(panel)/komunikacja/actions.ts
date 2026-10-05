"use server";
/**
 * Writes of "Komunikacja": template save/restore, broadcast test (mail to the signed-in admin only), broadcast
 * creation (step-up; it only QUEUES the mail, the site's cron sends it) and cancel. Real mail leaves only
 * through sendBroadcastTest (to yourself) and the queued broadcast, both behind this gate.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { cancelBroadcast, createBroadcast, deleteEmailTemplate, sendBroadcastTest, upsertEmailTemplate } from "@/lib/modules/email";
import { openGate } from "@admin/lib/actions/gate";
import { RATE } from "@admin/lib/actions/rate-limit";
import { errorMessage, zodFieldErrors, type ActionResult } from "@admin/lib/actions/panel";

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Małe litery, cyfry i myślniki.").min(3, "Co najmniej 3 znaki.").max(60, "Najwyżej 60 znaków.");
const optionalText = (max: number) => z.string().max(max, `Najwyżej ${max} znaków.`).transform((v) => (v.trim() === "" ? null : v));

const templateSchema = z
  .object({
    slug,
    name: optionalText(80),
    description: optionalText(300),
    subject: z.string().trim().min(1, "Podaj temat.").max(200, "Najwyżej 200 znaków."),
    html: z.string().trim().min(1, "Podaj treść.").max(100_000, "Najwyżej 100 000 znaków."),
    subjectEn: optionalText(200),
    htmlEn: optionalText(100_000),
  })
  .strict();

export async function saveTemplateAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const gate = await openGate({ path: "/komunikacja?tab=szablony", rate: RATE.template });
  if (!gate.ok) return gate.result;
  const raw = Object.fromEntries(["slug", "name", "description", "subject", "html", "subjectEn", "htmlEn"].map((k) => [k, String(fd.get(k) ?? "")]));
  const parsed = templateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Popraw zaznaczone pola.", fieldErrors: zodFieldErrors(parsed.error.issues) };
  const d = parsed.data;
  if ((d.subjectEn === null) !== (d.htmlEn === null)) return { ok: false, message: "Wersja angielska musi mieć i temat, i treść (albo obie puste).", fieldErrors: { [d.subjectEn === null ? "subjectEn" : "htmlEn"]: "Uzupełnij albo wyczyść obie angielskie wersje." } };
  const res = await upsertEmailTemplate(gate.ctx, { slug: d.slug, name: d.name, description: d.description, subject: d.subject, html: d.html, subjectEn: d.subjectEn, htmlEn: d.htmlEn });
  if (!res.ok) return { ok: false, message: res.error.message, fieldErrors: res.error.code === "EMAIL_TEMPLATE_INVALID_VARIABLES" ? { html: res.error.message } : undefined };
  revalidatePath("/komunikacja");
  return { ok: true, message: "Szablon zapisany. Od teraz mail idzie z tym tekstem." };
}

const slugOnly = z.object({ slug }).strict();

export async function resetTemplateAction(input: { slug: string }): Promise<ActionResult<{ restoredDefault: boolean }>> {
  const gate = await openGate({ path: "/komunikacja?tab=szablony", rate: RATE.template });
  if (!gate.ok) return gate.result;
  const parsed = slugOnly.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Niepoprawne żądanie." };
  const res = await deleteEmailTemplate(gate.ctx, parsed.data.slug);
  if (!res.ok) return { ok: false, message: res.error.code === "EMAIL_TEMPLATE_NOT_FOUND" ? "Ten szablon już nie istnieje albo jest domyślny." : errorMessage(res.error).message };
  revalidatePath("/komunikacja");
  return { ok: true, message: res.data.restoredDefault ? "Przywrócono tekst domyślny." : "Szablon usunięty.", data: { restoredDefault: res.data.restoredDefault } };
}

const contentSchema = z.object({
  subjectPl: z.string().trim().min(1, "Podaj temat po polsku.").max(200, "Najwyżej 200 znaków."),
  htmlPl: z.string().trim().min(1, "Podaj treść po polsku.").max(100_000, "Najwyżej 100 000 znaków."),
  subjectEn: z.string().max(200, "Najwyżej 200 znaków.").default(""),
  htmlEn: z.string().max(100_000, "Najwyżej 100 000 znaków.").default(""),
});
const testSchema = contentSchema.extend({ language: z.enum(["pl", "en"]) }).strict();
const createSchema = contentSchema.extend({ requestKey: z.string().regex(/^[A-Za-z0-9-]{16,64}$/) }).strict();

export type BroadcastContentInput = z.input<typeof contentSchema>;

export async function sendBroadcastTestAction(input: BroadcastContentInput & { language: "pl" | "en" }): Promise<ActionResult> {
  const gate = await openGate({ path: "/komunikacja?tab=rozsylki", rate: RATE.mail });
  if (!gate.ok) return gate.result;
  const parsed = testSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Popraw zaznaczone pola.", fieldErrors: zodFieldErrors(parsed.error.issues) };
  // The address comes from the signed-in panel account, never from the request.
  const res = await sendBroadcastTest(gate.ctx, { ...parsed.data, recipient: { email: gate.viewer.email, name: gate.viewer.name } });
  if (!res.ok) return { ok: false, message: res.error.message };
  return { ok: true, message: `Test wysłany na ${gate.viewer.email}.` };
}

export async function createBroadcastAction(input: BroadcastContentInput & { requestKey: string }): Promise<ActionResult<{ recipientCount: number; duplicate: boolean }>> {
  const gate = await openGate({ path: "/komunikacja?tab=rozsylki", rate: RATE.mail, stepUp: true });
  if (!gate.ok) return gate.result;
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Popraw zaznaczone pola.", fieldErrors: zodFieldErrors(parsed.error.issues) };
  const res = await createBroadcast(gate.ctx, parsed.data);
  if (!res.ok) return { ok: false, message: res.error.message };
  revalidatePath("/komunikacja");
  return { ok: true, message: res.data.duplicate ? "Ta rozsyłka już została utworzona." : `Rozsyłka w kolejce: ${res.data.recipientCount} odbiorców. Kolejka wysyła ją stopniowo.`, data: { recipientCount: res.data.recipientCount, duplicate: res.data.duplicate } };
}

const cancelSchema = z.object({ id: z.string().min(1).max(100) }).strict();

export async function cancelBroadcastAction(input: { id: string }): Promise<ActionResult> {
  const gate = await openGate({ path: "/komunikacja?tab=rozsylki", rate: RATE.mail });
  if (!gate.ok) return gate.result;
  const parsed = cancelSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Niepoprawne żądanie." };
  const res = await cancelBroadcast(gate.ctx, parsed.data.id);
  if (!res.ok) return { ok: false, message: res.error.message };
  revalidatePath("/komunikacja");
  return { ok: true, message: `Rozsyłka anulowana. Pominięto ${res.data.skipped} nieodebranych adresatów.` };
}
