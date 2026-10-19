import { validateImageDataUrl } from "@/lib/auth/avatar";
import { BANNER_MAX_DATA_URL_CHARS } from "./channel-banner-limits";

export * from "./channel-banner-limits";

/** Server-side check of the banner data URL sent by the browser (type, size, file signature). */
export function validateBannerDataUrl(value: unknown) {
  return validateImageDataUrl(value, BANNER_MAX_DATA_URL_CHARS);
}
