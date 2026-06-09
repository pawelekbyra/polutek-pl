export type MediaHostEnv = Record<string, string | undefined>;

export function parseMediaHosts(value?: string | null): string[] {
  if (!value) return [];

  return value
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean)
    .map((host) => {
      try {
        return new URL(host).hostname.toLowerCase();
      } catch {
        return host.replace(/^https?:\/\//, '').split('/')[0].toLowerCase();
      }
    })
    .filter(Boolean);
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

export function isSafeLocalPath(value: string) {
  if (!value.startsWith("/") || value.startsWith("//") || value.includes('\\')) return false;

  let decodedValue = value;
  try {
    decodedValue = decodeURIComponent(value.split(/[?#]/, 1)[0]);
  } catch {
    return false;
  }

  return decodedValue.startsWith('/')
    && !decodedValue.startsWith('//')
    && !decodedValue.split('/').some((segment) => segment === '..');
}

/**
 * Detection exists for validation/classification only.
 * It does not mean manifest rewriting or segment proxy delivery is implemented.
 */
export function isHlsOrDashManifest(url: string): boolean {
  const normalized = url.toLowerCase().split('?')[0];
  return normalized.endsWith('.m3u8') || normalized.endsWith('.mpd');
}

export function isDirectMediaSource(url: string): boolean {
  const normalized = url.toLowerCase().split('?')[0];
  return (
    normalized.endsWith('.mp4') ||
    normalized.endsWith('.webm') ||
    normalized.endsWith('.ogg') ||
    normalized.endsWith('.mov') ||
    normalized.endsWith('.wav') ||
    normalized.endsWith('.mp3')
  );
}
