/**
 * VideoAsset.sizeBytes is a BigInt column (an HLS tree can exceed 2 GiB), but JSON cannot carry a bigint
 * (JSON.stringify throws) and every consumer of the DTOs wants a plain number. A file size stays far below
 * Number.MAX_SAFE_INTEGER (9 PB), so the conversion is exact; anything unsafe or missing becomes null.
 */
export function assetSizeToNumber(value: bigint | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "bigint" ? Number(value) : value;
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
}
