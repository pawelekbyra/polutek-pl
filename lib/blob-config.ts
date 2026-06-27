export type BlobAccess = "public" | "private";

export function getBlobAccess(): BlobAccess {
  const access = process.env.VERCEL_BLOB_ACCESS?.toLowerCase();

  // The production Vercel Blob store is configured for private access.
  // Default to private so missing env config does not accidentally attempt
  // forbidden public uploads. Set VERCEL_BLOB_ACCESS=public explicitly only
  // for stores that support public blobs.
  return access === "public" ? "public" : "private";
}
