import { describe, expect, it } from 'vitest';
import { appendQueryString, getExplicitLocaleHref, getLocaleAlternates, getLocalizedHref, localizedPathFromLegacyPath, switchLocalePath } from '@/lib/i18n/routing';
import { readFileSync } from 'node:fs';

const middleware = () => readFileSync('middleware.ts', 'utf8');

describe('locale-first public routing', () => {
  it('builds localized hrefs and preserves query strings', () => {
    expect(getLocalizedHref('pl', 'watch', { slug: 'film-test' })).toBe('/watch/film-test');
    expect(getLocalizedHref('en', 'terms')).toBe('/en/terms');
    expect(appendQueryString('/en/search', 'q=test')).toBe('/en/search?q=test');
  });

  it('maps legacy public paths to locale-prefixed equivalents', () => {
    expect(localizedPathFromLegacyPath('/watch/some-slug', 'pl')).toBe('/watch/some-slug');
    expect(localizedPathFromLegacyPath('/channel/main', 'en')).toBe('/en/channel/main');
    expect(localizedPathFromLegacyPath('/regulamin', 'en')).toBe('/en/terms');
    expect(localizedPathFromLegacyPath('/polityka-prywatnosci', 'pl')).toBe('/polityka-prywatnosci');
    expect(localizedPathFromLegacyPath('/sklep', 'pl')).toBeNull();
  });

  it('switches between equivalent localized public routes', () => {
    expect(switchLocalePath('/watch/my-video', 'en')).toBe('/en/watch/my-video');
    expect(switchLocalePath('/en/privacy-policy', 'pl')).toBe('/polityka-prywatnosci');
    expect(switchLocalePath('/regulamin', 'en')).toBe('/en/terms');
  });

  it('keeps localized public routes public without exposing admin routes', () => {
    const source = middleware();
    for (const route of ['/watch/(.*)', '/en/watch/(.*)', '/regulamin', '/en/terms']) {
      expect(source).toContain(route);
    }
    expect(source).toContain("const isAdminRoute = createRouteMatcher(['/admin(.*)', '/api/admin(.*)']);");
  });
});

describe('language-explicit URLs for search engines and redirects', () => {
  it('names the locale for both languages', () => {
    expect(getExplicitLocaleHref('pl', 'home')).toBe('/pl');
    expect(getExplicitLocaleHref('en', 'home')).toBe('/en');
    expect(getExplicitLocaleHref('pl', 'terms')).toBe('/pl/regulamin');
    expect(getExplicitLocaleHref('en', 'privacy')).toBe('/en/privacy-policy');
    expect(getExplicitLocaleHref('pl', 'watch', { slug: 'a b' })).toBe('/pl/watch/a%20b');
  });

  it('builds the canonical URL and the hreflang pair, English as x-default', () => {
    expect(getLocaleAlternates('pl', 'home', { query: 'v=film', baseUrl: 'https://x.test' })).toEqual({
      canonical: 'https://x.test/pl?v=film',
      languages: { pl: 'https://x.test/pl?v=film', en: 'https://x.test/en?v=film', 'x-default': 'https://x.test/en?v=film' },
    });
    expect(getLocaleAlternates('en', 'terms').languages).toEqual({ pl: '/pl/regulamin', en: '/en/terms', 'x-default': '/en/terms' });
  });
});
