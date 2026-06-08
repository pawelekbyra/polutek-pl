export function parseMediaHosts(value?: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((host) => {
        const trimmed = host.trim();
        try {
            if (trimmed.startsWith('http')) {
                return new URL(trimmed).hostname.toLowerCase();
            }
            return trimmed.toLowerCase();
        } catch {
            return trimmed.toLowerCase();
        }
    })
    .filter((host) => host.length > 0);
}

export type MediaHostEnv = {
    MEDIA_BUCKET_HOST?: string;
    NEXT_PUBLIC_R2_PUBLIC_HOST?: string;
    NEXT_PUBLIC_BLOB_PUBLIC_HOST?: string;
    ALLOWED_MEDIA_HOSTS?: string;
    ALLOWED_COMMENT_IMAGE_HOSTS?: string;
    ALLOWED_AVATAR_HOSTS?: string;
    ALLOWED_THUMBNAIL_HOSTS?: string;
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

function normalizeHostname(hostname: string) {
    return hostname.trim().toLowerCase().replace(/^\[|\]$/g, '');
}

function isPrivateIpv4(hostname: string) {
    const parts = hostname.split('.');
    if (parts.length !== 4) return false;

    const octets = parts.map((part) => {
        if (!/^\d{1,3}$/.test(part)) return Number.NaN;
        return Number(part);
    });

    if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
        return false;
    }

    const [first, second] = octets;
    return first === 10
        || first === 127
        || first === 0
        || (first === 169 && second === 254)
        || (first === 172 && second >= 16 && second <= 31)
        || (first === 192 && second === 168);
}

function isPrivateIpv6(hostname: string) {
    const host = normalizeHostname(hostname);
    if (!host.includes(':')) return false;

    return host === '::1'
        || host === '0:0:0:0:0:0:0:1'
        || host.startsWith('fc')
        || host.startsWith('fd')
        || host.startsWith('fe80:');
}

export function isBlockedPrivateHostname(hostname: string) {
    const host = normalizeHostname(hostname);
    return host === 'localhost'
        || host.endsWith('.localhost')
        || isPrivateIpv4(host)
        || isPrivateIpv6(host);
}
