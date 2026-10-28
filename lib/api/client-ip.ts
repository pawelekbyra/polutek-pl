/**
 * Single source of truth for "who is calling" (rate limits, audit log).
 *
 * Default: the LAST X-Forwarded-For hop, then X-Real-IP. The trusted proxy appends the
 * real client address, so the first hop is client-controlled and must not be trusted.
 *
 * Self-hosted behind a Cloudflare Tunnel (see docs/operations/SERWEREK.md): set
 * TRUST_CF_CONNECTING_IP=true and the real address is taken from CF-Connecting-IP.
 * Only enable it when the app is reachable exclusively through Cloudflare (Tunnel,
 * origin on 127.0.0.1); otherwise anyone could spoof the header.
 */
const MAX_IP_LENGTH = 64;

function cleanIp(value: string | null | undefined): string | null {
  const v = value?.trim();
  if (!v || v.length > MAX_IP_LENGTH || /[\s,]/.test(v)) return null;
  return v;
}

export function isCfConnectingIpTrusted(): boolean {
  return process.env.TRUST_CF_CONNECTING_IP?.trim().toLowerCase() === "true";
}

export function getClientIp(headers: Headers): string {
  if (isCfConnectingIpTrusted()) {
    const cf = cleanIp(headers.get("cf-connecting-ip"));
    if (cf) return cf;
  }
  const forwarded = headers
    .get("x-forwarded-for")
    ?.split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  return forwarded?.[forwarded.length - 1] || headers.get("x-real-ip")?.trim() || "unknown";
}
