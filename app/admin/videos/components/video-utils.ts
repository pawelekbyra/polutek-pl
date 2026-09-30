export const slugify = (text: string) => {
  return text.toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-').replace(/[^\w-]+/g, '').replace(/--+/g, '-').replace(/^-+/, '').replace(/-+$/, '');
};

export const normalizeCloudflareSource = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";

  try {
    const url = new URL(trimmed);
    const pathParts = url.pathname.split("/").filter(Boolean);
    if (url.hostname.includes("videodelivery.net") && pathParts[0]) return pathParts[0];
    if (url.hostname.includes("cloudflarestream.com") && pathParts[0]) return pathParts[0];
    const uidFromSearch = url.searchParams.get("video") || url.searchParams.get("uid");
    if (uidFromSearch) return uidFromSearch.trim();
  } catch {
    // Not a URL; treat it as a raw Cloudflare Stream UID.
  }

  return trimmed.replace(/^stream:/i, "").replace(/^uid:/i, "").trim();
};

export const INITIAL_FORM_DATA = {
  id: "",
  title: "",
  titleEn: "",
  slug: "",
  description: "",
  descriptionEn: "",
  videoUrl: "",
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
