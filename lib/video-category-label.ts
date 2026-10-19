import { isVideoCategory } from "@/lib/video-metadata";
import type { Tx } from "@/lib/i18n/ui";

/**
 * Category name in the viewer's language. The texts are literal `tx()` calls on purpose (the catalog test reads them);
 * `VIDEO_CATEGORY_LABELS` in lib/video-metadata.ts is the table they must equal (tested). Unknown keys return "".
 */
export function videoCategoryLabel(tx: Tx, key: string | null | undefined): string {
  if (!isVideoCategory(key)) return "";
  switch (key) {
    case "education": return tx("Edukacja", "Education");
    case "entertainment": return tx("Rozrywka", "Entertainment");
    case "music": return tx("Muzyka", "Music");
    case "gaming": return tx("Gry", "Gaming");
    case "news": return tx("Wiadomości", "News");
    case "science": return tx("Nauka i technika", "Science and technology");
    case "sports": return tx("Sport", "Sports");
    case "people": return tx("Ludzie i blogi", "People and blogs");
    case "howto": return tx("Poradniki", "How-to");
    case "other": return tx("Inne", "Other");
  }
}
