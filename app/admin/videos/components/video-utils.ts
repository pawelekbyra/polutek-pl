import { SUPPORTED_CURRENCIES, type SupportedCurrency } from "@/lib/constants";

export const slugify = (text: string) => {
  return text.toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-').replace(/[^\w-]+/g, '').replace(/--+/g, '-').replace(/^-+/, '').replace(/-+$/, '');
};

export const INITIAL_FORM_DATA = {
  id: "",
  title: "",
  titleEn: "",
  slug: "",
  description: "",
  descriptionEn: "",
  thumbnailUrl: "",
  duration: "",
  tier: "PUBLIC",
  status: "DRAFT",
  likesCount: 0,
  dislikesCount: 0,
  views: 0,
  isMainFeatured: false,
  showInSidebar: false,
  sidebarOrder: 0,
  subtitleUrlPl: "",
  subtitleUrlEn: "",
  /** "Publikacja": NOW = publish immediately, PREMIERE = at premiereLocal (CLAUDE.md "Premieres"). */
  publishMode: "NOW" as PublishMode,
  /** `<input type="datetime-local">` value in the admin's local time, e.g. "2026-12-31T20:00". */
  premiereLocal: "",
  /** Stored premiere (ISO) as loaded, to tell a new premiere from an unchanged one. */
  savedPremiereAt: null as string | null,
};

export type PublishMode = "NOW" | "PREMIERE";

const pad2 = (n: number) => String(n).padStart(2, "0");

/** ISO timestamp → datetime-local value in the browser's time zone. */
export function isoToDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/** datetime-local value (local time) → ISO UTC string, or null when empty/invalid. */
export function datetimeLocalToIso(local: string): string | null {
  if (!local) return null;
  const [datePart, timePart] = local.split("T");
  const [y, m, d] = (datePart ?? "").split("-").map(Number);
  const [hh, mm] = (timePart ?? "").split(":").map(Number);
  if (![y, m, d, hh, mm].every(Number.isFinite)) return null;
  const date = new Date(y, m - 1, d, hh, mm, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Publication fields loaded from an admin video DTO. */
export function publicationFormFields(video: { premiereAt?: unknown }) {
  const iso = typeof video.premiereAt === "string" ? video.premiereAt : null;
  const upcoming = iso !== null && new Date(iso).getTime() > Date.now();
  return {
    publishMode: (upcoming ? "PREMIERE" : "NOW") as PublishMode,
    premiereLocal: upcoming ? isoToDatetimeLocal(iso) : "",
    savedPremiereAt: iso,
  };
}

/**
 * Publication part of a video write. `premiereAt` is ISO UTC, null ("publish
 * now" cancels a premiere that hasn't happened yet) or absent (leave a past
 * premiere alone: it still dates the video). Returns an error message when the
 * premiere is missing or a new one is not in the future (the server checks this too).
 */
export function buildPublicationPayload(form: {
  publishMode: PublishMode;
  premiereLocal: string;
  savedPremiereAt: string | null;
}): { premiereAt?: string | null } | { error: string } {
  if (form.publishMode !== "PREMIERE") {
    const savedIsUpcoming = form.savedPremiereAt !== null && new Date(form.savedPremiereAt).getTime() > Date.now();
    return savedIsUpcoming ? { premiereAt: null } : {};
  }
  const iso = datetimeLocalToIso(form.premiereLocal);
  if (!iso) return { error: "Podaj datę i godzinę premiery." };
  const unchanged = form.savedPremiereAt !== null && new Date(form.savedPremiereAt).getTime() === new Date(iso).getTime();
  if (!unchanged && new Date(iso).getTime() <= Date.now()) {
    return { error: "Data premiery musi być w przyszłości." };
  }
  return { premiereAt: iso };
}

/** "Cel zbiórki" form state (CLAUDE.md "Fundraising progress bar"). Amount in main units as typed. */
export type FundraisingFormState = {
  /** Hand-set bar fill in whole percent, as typed; empty = off. Wins over the goal. */
  manualPercent: string;
  /** The loaded video already had a hand-set fill (so an empty field turns it off). */
  hadManualPercent: boolean;
  amount: string;
  currency: SupportedCurrency;
  /** `<input type="date">` value; empty = count every tip ever. */
  startDate: string;
  /** The loaded video already had a goal (so an empty amount removes it). */
  hadGoal: boolean;
};

function todayLocalDate(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

/** Fundraising fields loaded from an admin video DTO. A new goal counts from today by default. */
export function fundraisingFormFields(video: {
  fundraisingGoalMinor?: unknown;
  fundraisingGoalCurrency?: unknown;
  fundraisingStartAt?: unknown;
  fundraisingManualPercent?: unknown;
} | null): FundraisingFormState {
  const manual = typeof video?.fundraisingManualPercent === "number" ? video.fundraisingManualPercent : null;
  const manualFields = { manualPercent: manual === null ? "" : String(manual), hadManualPercent: manual !== null };
  const minor = typeof video?.fundraisingGoalMinor === "number" ? video.fundraisingGoalMinor : null;
  const currency = typeof video?.fundraisingGoalCurrency === "string"
    && (SUPPORTED_CURRENCIES as readonly string[]).includes(video.fundraisingGoalCurrency)
    ? video.fundraisingGoalCurrency as SupportedCurrency
    : "PLN";
  if (minor === null) return { ...manualFields, amount: "", currency, startDate: todayLocalDate(), hadGoal: false };
  const start = typeof video?.fundraisingStartAt === "string" ? new Date(video.fundraisingStartAt) : null;
  return {
    ...manualFields,
    amount: String(minor / 100),
    currency,
    startDate: start && !Number.isNaN(start.getTime()) ? todayLocalDate(start) : "",
    hadGoal: true,
  };
}

type FundraisingGoalPayload = { amountMinor: number; currency: SupportedCurrency; startAt: string | null };

/**
 * Hand-set fill part of a video write: `{ fundraisingManualPercent: n }` to set
 * it, `null` to turn it off (field cleared), `{}` when there was none and none
 * is entered. Whole percent 0..100 only.
 */
export function buildManualPercentPayload(form: Pick<FundraisingFormState, "manualPercent" | "hadManualPercent">):
  | { fundraisingManualPercent?: number | null }
  | { error: string } {
  const raw = form.manualPercent.replace(/\s|%/g, "");
  if (!raw) return form.hadManualPercent ? { fundraisingManualPercent: null } : {};
  if (!/^\d+$/.test(raw) || Number(raw) > 100) return { error: "Wypełnienie paska musi być liczbą całkowitą od 0 do 100." };
  return { fundraisingManualPercent: Number(raw) };
}

/**
 * Fundraising part of a video write: the hand-set fill (see above) plus
 * `{ fundraisingGoal: {...} }` to set the goal, `{ fundraisingGoal: null }` to
 * remove it (amount cleared), nothing when there was none and none is entered.
 * Returns an error message for an invalid percent or amount.
 */
export function buildFundraisingPayload(form: FundraisingFormState):
  | { fundraisingGoal?: FundraisingGoalPayload | null; fundraisingManualPercent?: number | null }
  | { error: string } {
  const manual = buildManualPercentPayload(form);
  if ("error" in manual) return manual;
  const goal = buildGoalPayload(form);
  if ("error" in goal) return goal;
  return { ...manual, ...goal };
}

function buildGoalPayload(form: FundraisingFormState):
  | { fundraisingGoal?: FundraisingGoalPayload | null }
  | { error: string } {
  const raw = form.amount.replace(/\s/g, "").replace(",", ".");
  if (!raw) return form.hadGoal ? { fundraisingGoal: null } : {};
  const value = Number(raw);
  const amountMinor = Math.round(value * 100);
  if (!Number.isFinite(value) || amountMinor <= 0) return { error: "Cel zbiórki musi być kwotą większą od zera." };
  if (amountMinor > 1_000_000_000) return { error: "Cel zbiórki może wynosić najwyżej 10 000 000." };
  let startAt: string | null = null;
  if (form.startDate) {
    const [y, m, d] = form.startDate.split("-").map(Number);
    const date = new Date(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0);
    if (!Number.isFinite(y) || Number.isNaN(date.getTime())) return { error: "Podaj poprawną datę początku zbiórki." };
    startAt = date.toISOString();
  }
  return { fundraisingGoal: { amountMinor, currency: form.currency, startAt } };
}