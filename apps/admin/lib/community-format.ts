/** Polish labels and small helpers shared by the "Społeczność" screens (server and client safe). */
export const COMMENT_STATUS: Record<string, { kind: "ok" | "warn" | "info" | ""; label: string }> = {
  VISIBLE: { kind: "", label: "Widoczny" },
  HELD_FOR_REVIEW: { kind: "info", label: "Wstrzymany" },
  HIDDEN: { kind: "warn", label: "Ukryty" },
  DELETED: { kind: "", label: "Usunięty" },
};

export const REPORT_REASON: Record<string, string> = { SPAM: "spam", HARASSMENT: "nękanie", HATE: "nienawiść", NSFW: "treści dla dorosłych", SPOILER: "spoiler", OTHER: "inne" };

export const PAYMENT_STATUS: Record<string, string> = { SUCCEEDED: "opłacona", PENDING: "w toku", FAILED: "nieudana", CANCELED: "anulowana", REFUNDED: "zwrócona", PARTIALLY_REFUNDED: "częściowo zwrócona", DISPUTED: "spór", CHARGEBACK_LOST: "spór przegrany" };

export const GRANT_SOURCE: Record<string, string> = { STRIPE_TIP: "napiwek", PAYMENT: "płatność", REFERRAL: "polecenie", ADMIN: "ręcznie", MIGRATION: "migracja", LEGACY: "dawny status" };

export const SEGMENTS: [string, string][] = [
  ["", "Wszyscy"],
  ["nowi", "Nowi (7 dni)"],
  ["aktywni", "Aktywni (30 dni)"],
  ["wspierajacy", "Ze znacznikiem wspierającego"],
  ["platnicy", "Z napiwkiem"],
  ["niezweryfikowani", "Niezweryfikowani"],
  ["2fa", "Z 2FA lub kluczem"],
  ["wyciszeni", "Wyciszeni"],
  ["administratorzy", "Administratorzy"],
  ["usunieci", "Usunięte konta"],
];

export const USER_SORT_LABEL: Record<string, string> = { "created-desc": "Najnowsi", "created-asc": "Najstarsi", "nick-asc": "Pseudonim A–Z", "nick-desc": "Pseudonim Z–A", "wplaty-desc": "Najwięcej wpłat", "wplaty-asc": "Najmniej wpłat" };

export const initials = (name: string) => name.replace(/[^A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]/g, "").slice(0, 2).toUpperCase() || "?";

/** Builds a URL with the non-empty params only, so a cleared filter leaves no `?x=` behind. */
export function withParams(path: string, params: Record<string, string | number | undefined | null>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
  const s = q.toString();
  return s ? `${path}?${s}` : path;
}

export function muteUntilLabel(iso: string): string {
  return new Date(iso).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
