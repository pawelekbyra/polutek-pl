import {
  DEFAULT_VIDEO_THUMBNAIL_URL,
  buildCloudflareFirstFrameThumbnailUrl,
  isCloudflareFirstFrameThumbnailUrl,
  normalizeThumbnailSourceMode,
  type ThumbnailSourceMode,
} from "@/lib/media/cloudflare-thumbnail";

export { normalizeThumbnailSourceMode };
export type { ThumbnailSourceMode };

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

export function inferThumbnailSourceMode(thumbnailUrl: string | null | undefined): ThumbnailSourceMode {
  if (!thumbnailUrl || thumbnailUrl === DEFAULT_VIDEO_THUMBNAIL_URL) return "DEFAULT";
  return isCloudflareFirstFrameThumbnailUrl(thumbnailUrl) ? "CLOUDFLARE_FIRST_FRAME" : "CUSTOM";
}

export function resolveThumbnailUrlForMode(args: {
  mode: ThumbnailSourceMode;
  currentUrl?: string | null;
  cloudflareProviderAssetId?: string | null;
}): string {
  const mode = normalizeThumbnailSourceMode(args.mode);
  if (mode === "DEFAULT") return "";
  if (mode === "CLOUDFLARE_FIRST_FRAME") {
    return args.cloudflareProviderAssetId
      ? buildCloudflareFirstFrameThumbnailUrl(args.cloudflareProviderAssetId)
      : "";
  }
  return args.currentUrl || "";
}

export const INITIAL_FORM_DATA = {
  id: "",
  title: "",
  titleEn: "",
  slug: "",
  description: "",
  descriptionEn: "",
  videoUrl: "",
  thumbnailUrl: "",
  thumbnailSource: "DEFAULT" as ThumbnailSourceMode,
  cloudflareProviderAssetId: "",
  duration: "",
  tier: "PUBLIC",
  status: "DRAFT",
  likesCount: 0,
  dislikesCount: 0,
  views: 0,
  isMainFeatured: false,
  showInSidebar: false,
  sidebarOrder: 0
};
