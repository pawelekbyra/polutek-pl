export const VIDEO_DETAILS_TABS = [
  "summary",
  "content",
  "media",
  "access",
  "diagnostics",
  "comments",
  "stats",
  "audit",
] as const;

export type VideoDetailsTab = (typeof VIDEO_DETAILS_TABS)[number];

const VIDEO_DETAILS_TAB_SET = new Set<string>(VIDEO_DETAILS_TABS);

function normalizeTab(value: string | null): VideoDetailsTab | null {
  return value && VIDEO_DETAILS_TAB_SET.has(value)
    ? (value as VideoDetailsTab)
    : null;
}

export function resolveInitialVideoDetailsTab(search: string, hash: string): VideoDetailsTab {
  const tabFromQuery = normalizeTab(new URLSearchParams(search).get("tab"));
  if (tabFromQuery) return tabFromQuery;

  const tabFromHash = normalizeTab(hash.replace(/^#/, ""));
  return tabFromHash || "summary";
}

export function buildCreatedVideoUploadUrl(videoId: string): string {
  return `/admin/videos/${encodeURIComponent(videoId)}?tab=media#media`;
}
