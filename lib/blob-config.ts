export type BlobAccess = "public" | "private";

export function getBlobAccess(): BlobAccess {
  const access = process.env.VERCEL_BLOB_ACCESS;
  return access === "private" ? "private" : "public";
}
