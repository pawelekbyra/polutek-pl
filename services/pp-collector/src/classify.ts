/**
 * Coarse, privacy-preserving classification of a request. The raw user agent and referrer URL are
 * never stored: only these classes and the referrer's host survive.
 */

export type DeviceClass = 'mobile' | 'tablet' | 'desktop';

// Crawlers, link previews, monitors, headless browsers and HTTP libraries. Kept deliberately broad:
// a false positive costs one lost page view, a false negative pollutes every chart.
const BOT_PATTERN =
  /bot\b|bot\/|crawl|spider|slurp|archiver|bingpreview|facebookexternalhit|facebookcatalog|embedly|link ?preview|whatsapp|telegram|discord|skypeuripreview|slack|headless|lighthouse|pagespeed|chrome-lighthouse|gtmetrix|pingdom|uptime|monitor|statuscake|python|curl\/|wget|httpclient|http_request|java\/|go-http|okhttp|axios|node-fetch|undici|phantomjs|selenium|puppeteer|playwright|scrapy|feedfetcher|mediapartners|adsbot|yandex|baidu|petalbot|semrush|ahrefs|mj12|dotbot|bytespider|gptbot|claudebot|ccbot|perplexity/i;

export function isBotUserAgent(userAgent: string | undefined): boolean {
  if (!userAgent || userAgent.length < 20 || userAgent.length > 1024) return true;
  return BOT_PATTERN.test(userAgent);
}

export function classifyDevice(userAgent: string): DeviceClass {
  if (/ipad|tablet|kindle|silk|playbook|(android(?!.*mobile))/i.test(userAgent)) return 'tablet';
  if (/mobi|iphone|ipod|android|windows phone|blackberry|opera mini/i.test(userAgent)) return 'mobile';
  return 'desktop';
}

export function classifyBrowser(userAgent: string): string {
  if (/edg(e|a|ios)?\//i.test(userAgent)) return 'Edge';
  if (/opr\/|opera/i.test(userAgent)) return 'Opera';
  if (/samsungbrowser/i.test(userAgent)) return 'Samsung Internet';
  if (/firefox|fxios/i.test(userAgent)) return 'Firefox';
  if (/crios|chrome|chromium/i.test(userAgent)) return 'Chrome';
  if (/safari/i.test(userAgent)) return 'Safari';
  return 'Other';
}

export function classifyOs(userAgent: string): string {
  if (/windows/i.test(userAgent)) return 'Windows';
  if (/iphone|ipad|ipod/i.test(userAgent)) return 'iOS';
  if (/android/i.test(userAgent)) return 'Android';
  if (/cros/i.test(userAgent)) return 'ChromeOS';
  if (/mac os x|macintosh/i.test(userAgent)) return 'macOS';
  if (/linux/i.test(userAgent)) return 'Linux';
  return 'Other';
}

function bareHost(host: string): string {
  return host.toLowerCase().replace(/^www\./, '');
}

/** Host of the referring page, or null for direct visits, internal navigation and anything malformed. */
export function referrerHost(referrer: string | undefined, ownHosts: readonly string[]): string | null {
  if (!referrer) return null;
  try {
    const url = new URL(referrer);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    const host = bareHost(url.hostname);
    if (!host || host.length > 253) return null;
    if (ownHosts.some((own) => bareHost(own) === host)) return null;
    return host;
  } catch {
    return null;
  }
}

/** Path without query, fragment or trailing slash; null when it does not look like one of our paths. */
export function normalizePath(path: string): string | null {
  const bare = path.split(/[?#]/, 1)[0] ?? '';
  if (!bare.startsWith('/') || bare.startsWith('//')) return null;
  if (!/^\/[A-Za-z0-9\-._~/%]*$/.test(bare)) return null;
  const trimmed = bare.length > 1 ? bare.replace(/\/+$/, '') || '/' : bare;
  return trimmed.slice(0, 200);
}

/** ISO 3166-1 alpha-2 from Cloudflare's CF-IPCountry; XX (unknown) and T1 (Tor) count as unknown. */
export function normalizeCountry(value: string | undefined): string | null {
  if (!value) return null;
  const code = value.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code) || code === 'XX' || code === 'T1') return null;
  return code;
}

/** utm_* values: lowercase, trimmed, limited alphabet (they are free text from links). */
export function normalizeCampaignValue(value: string | undefined): string | null {
  if (!value) return null;
  const cleaned = value.trim().toLowerCase().replace(/[^a-z0-9._~ -]/g, '').slice(0, 64);
  return cleaned || null;
}
