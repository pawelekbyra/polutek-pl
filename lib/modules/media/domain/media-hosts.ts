export function parseMediaHosts(value?: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter((host) => host.length > 0);
}

export type MediaHostEnv = {
    MEDIA_BUCKET_HOST?: string;
    NEXT_PUBLIC_R2_PUBLIC_HOST?: string;
    NEXT_PUBLIC_BLOB_PUBLIC_HOST?: string;
    ALLOWED_MEDIA_HOSTS?: string;
    [key: string]: any;
};

export function getAllowedMediaHosts(env: MediaHostEnv = process.env) {
    return new Set([
        ...parseMediaHosts(env.MEDIA_BUCKET_HOST),
        ...parseMediaHosts(env.NEXT_PUBLIC_R2_PUBLIC_HOST),
        ...parseMediaHosts(env.NEXT_PUBLIC_BLOB_PUBLIC_HOST),
        ...parseMediaHosts(env.ALLOWED_MEDIA_HOSTS),
    ]);
}
