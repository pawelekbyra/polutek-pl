import { parsePrivateThumbnailStorageUrl, parsePublicThumbnailUrl } from "@/lib/modules/media";

export type ThumbnailState = { kind: "ok" | "warn" | "info"; label: string; detail: string };

type Row = { status: string; thumbnailUrl: string | null; thumbnailPublicUrl: string | null };

/**
 * What the owner needs to know about a cover (CLAUDE.md 4.8): own or the channel default, and for a
 * published film whether the public R2 copy matches the current cover (otherwise the site serves it
 * through the slower proxy until the daily sync).
 */
export function thumbnailState(row: Row, env: Record<string, string | undefined> = process.env): ThumbnailState {
  const url = row.thumbnailUrl?.trim() || "";
  if (!url || url === "/logo.png") return { kind: "warn", label: "Domyślna", detail: "film nie ma własnej miniatury, strona pokazuje domyślną kanału" };
  const privateKey = parsePrivateThumbnailStorageUrl(url, env);
  if (!privateKey) return { kind: "info", label: "Obca", detail: "miniatura spoza naszego magazynu R2; działa przez proxy, nowa trafi do R2" };
  if (row.status !== "PUBLISHED") return { kind: "ok", label: "Własna", detail: "kopia publiczna powstanie przy publikacji" };
  const publicKey = parsePublicThumbnailUrl(row.thumbnailPublicUrl, env);
  if (publicKey === privateKey) return { kind: "ok", label: "Własna", detail: "kopia publiczna aktualna" };
  return { kind: "warn", label: "Niezsynchr.", detail: "kopia publiczna nieaktualna; strona używa proxy do nocnej synchronizacji" };
}
