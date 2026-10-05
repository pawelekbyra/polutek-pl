/**
 * Shared plumbing of every panel write (phase 2+): the AppContext of the signed-in panel admin, Polish
 * error messages for use-case errors, and Warsaw-local date conversion for datetime-local fields.
 * Each Server Action: requireAdmin() -> zod -> (step-up when sensitive) -> use case -> revalidate.
 */
import { headers } from "next/headers";
import { createAppContext, type AppContext } from "@/lib/modules/shared/app-context";
import { warsawOffsetMinutes } from "@/lib/modules/admin-overview";
import type { AdminViewer } from "@admin/lib/auth/guard";

export type ActionResult<T = undefined> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; message: string; fieldErrors?: Record<string, string>; code?: string };

/**
 * Use cases run with an "admin" actor whose id is the panel account (AdminUser.id): audit rows say who
 * acted, the cf-ray of the request is the request id.
 */
export async function panelContext(viewer: AdminViewer): Promise<AppContext> {
  const h = await headers();
  return createAppContext({
    actor: { type: "admin", userId: viewer.userId },
    requestId: h.get("cf-ray") ?? h.get("x-request-id") ?? undefined,
    // Audit rows say from where the admin acted (ADM-14: production had 0 of 25 admin rows with an IP).
    client: { ip: h.get("cf-connecting-ip")?.trim() || null, userAgent: h.get("user-agent")?.slice(0, 300) || null },
  });
}

const MESSAGES: Record<string, string> = {
  VIDEO_NOT_FOUND: "Ten film już nie istnieje.",
  VIDEO_NOT_ON_MAIN_CHANNEL: "Film nie należy do kanału.",
  VIDEO_SLUG_CONFLICT: "Ten adres (slug) ma już inny film.",
  VIDEO_INVALID_PREMIERE: "Termin premiery musi być w przyszłości.",
  ORIGINAL_MISSING: "Film nie ma wgranego oryginału.",
  ORIGINAL_NOT_READY: "Oryginał nie jest jeszcze wgrany do końca.",
  ENCODE_JOB_NOT_FOUND: "To zadanie kodowania już nie istnieje.",
  ENCODE_JOB_FINISHED: "To kodowanie już się zakończyło.",
  R2_NOT_CONFIGURED: "Magazyn R2 nie jest skonfigurowany w panelu.",
  CHANNEL_OWNER_UNCHANGED: "To konto już jest kontem kanału.",
  CHANNEL_OWNER_NOT_FOUND: "Nie ma takiego konta (albo zostało usunięte).",
  CHANNEL_OWNER_CONFLICT: "Konto kanału zmieniło się w międzyczasie. Odśwież stronę.",
  COVER_TOO_LARGE: "Miniatura może mieć najwyżej 5 MB.",
  COVER_INVALID_TYPE: "To nie jest obraz JPG, PNG ani WebP.",
  PAYMENT_NOT_FOUND: "Nie ma takiej wpłaty.",
  PAYMENT_NOT_REFUNDABLE: "Ta wpłata nie może być zwrócona w obecnym stanie.",
  PAYMENT_NO_STRIPE_INTENT: "Wpłata nie ma powiązania ze Stripe (brak identyfikatora intencji).",
  PAYMENT_ALREADY_REFUNDED: "Ta wpłata jest już w całości zwrócona.",
  INVALID_REFUND_AMOUNT: "Kwota zwrotu przekracza to, co zostało do zwrotu.",
  PAYMENT_PROVIDER_ERROR: "Stripe odrzucił operację albo nie odpowiada. Szczegóły są w logu serwera; sprawdź stan w Stripe, zanim spróbujesz ponownie.",
  LAYOUT_STALE: "Lista filmów się zmieniła. Odśwież układ i spróbuj ponownie.",
};

/** Polish text for an error from a use case; domain messages that are already Polish pass through. */
export function errorMessage(error: unknown, fallback = "Nie udało się zapisać. Spróbuj ponownie."): { message: string; code?: string } {
  const e = error as { code?: string; message?: string } | null;
  const code = e?.code;
  if (code && MESSAGES[code]) return { message: MESSAGES[code], code };
  if (e?.message && /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]|Podaj|Film|Wybierz|Zarchiwizowany|Publikacja|Wideo|Brakuje|Tylko/.test(e.message)) return { message: e.message, code };
  return { message: fallback, code };
}

/** "2026-10-06T20:00" typed in Warsaw time -> the UTC instant (correct across DST changes). */
export function warsawLocalToDate(local: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local.trim());
  if (!m) return null;
  const asUtc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  let instant = asUtc - warsawOffsetMinutes(new Date(asUtc)) * 60_000;
  instant = asUtc - warsawOffsetMinutes(new Date(instant)) * 60_000;
  return new Date(instant);
}

/** The UTC instant -> "YYYY-MM-DDTHH:mm" in Warsaw time, for a datetime-local field. */
export function dateToWarsawLocal(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  const shifted = new Date(d.getTime() + warsawOffsetMinutes(d) * 60_000);
  return shifted.toISOString().slice(0, 16);
}

/** `next dev` with sample data (ADMIN_DEV_FIXTURES=1) has no database: every write says so instead. */
export function sampleDataRefusal(): { ok: false; message: string; code: string } {
  return { ok: false, code: "SAMPLE_DATA", message: "Dane przykładowe: zapis jest wyłączony (ADMIN_DEV_FIXTURES=1)." };
}

/** Collects the first message per field from a zod error. */
export function zodFieldErrors(issues: { path: (string | number)[]; message: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const key = String(i.path[0] ?? "_");
    if (!out[key]) out[key] = i.message;
  }
  return out;
}
