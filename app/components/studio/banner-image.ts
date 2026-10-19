import { BANNER_HEIGHT_PX, BANNER_MAX_DATA_URL_CHARS, BANNER_WIDTH_PX } from "@/lib/modules/channel/domain/channel-banner-limits";

/**
 * Crops the chosen picture to the fixed 4:1 banner ratio (centre cover crop), resizes it and returns a JPEG data URL
 * small enough for the server limit. Throws when the browser cannot decode the file or the result stays too large.
 */
export async function fileToBannerDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = BANNER_WIDTH_PX;
    canvas.height = BANNER_HEIGHT_PX;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("canvas unavailable");
    const targetRatio = BANNER_WIDTH_PX / BANNER_HEIGHT_PX;
    let sw = bitmap.width;
    let sh = bitmap.width / targetRatio;
    if (sh > bitmap.height) {
      sh = bitmap.height;
      sw = bitmap.height * targetRatio;
    }
    context.drawImage(bitmap, (bitmap.width - sw) / 2, (bitmap.height - sh) / 2, sw, sh, 0, 0, BANNER_WIDTH_PX, BANNER_HEIGHT_PX);
    for (const quality of [0.85, 0.72, 0.6]) {
      const url = canvas.toDataURL("image/jpeg", quality);
      if (url.length <= BANNER_MAX_DATA_URL_CHARS) return url;
    }
    throw new Error("banner too large");
  } finally {
    bitmap.close();
  }
}
