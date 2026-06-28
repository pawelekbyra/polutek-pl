export type BlobAccess = any;

export function getBlobAccess(): BlobAccess {
  const access = process.env.VERCEL_BLOB_ACCESS?.toLowerCase();
  return access === "public" ? "public" : "private";
}
