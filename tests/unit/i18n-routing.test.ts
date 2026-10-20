import { describe, expect, it } from 'vitest';
import { appendQueryString, getExplicitLocaleHref, getLocaleAlternates, getLocalizedHref, getRouteLocaleFromPathname, isLocale, localizedPathFromLegacyPath, switchLocalePath, toContentLocale, UI_ONLY_LOCALES } from '@/lib/i18n/routing';
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

  it('keeps localized public routes public and routes the retired admin paths through the redirect map', () => {
    const source = middleware();
    for (const route of ['/watch/(.*)', '/en/watch/(.*)', '/regulamin', '/en/terms']) {
      expect(source).toContain(route);
    }
    expect(source).toContain('resolveLegacyAdminRedirect(req.nextUrl.pathname)');
    expect(source).toContain('isLegacyAdminApiPath(req.nextUrl.pathname)');
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

describe('interface-only languages (de, es, fr, it, pt, zh)', () => {
  it('mirror the English routes under their own prefix', () => {
    expect(getLocalizedHref('de', 'home')).toBe('/de');
    expect(getLocalizedHref('zh', 'search')).toBe('/zh/search');
    expect(getLocalizedHref('fr', 'watch', { slug: 'film' })).toBe('/fr/watch/film');
    expect(getLocalizedHref('pt', 'terms')).toBe('/pt/terms');
    expect(getLocalizedHref('it', 'privacy')).toBe('/it/privacy-policy');
    expect(getExplicitLocaleHref('es', 'home')).toBe('/es');
  });

  it('switch between all eight languages on the same page', () => {
    expect(switchLocalePath('/en/search', 'de')).toBe('/de/search');
    expect(switchLocalePath('/de/search', 'pl')).toBe('/search');
    expect(switchLocalePath('/de/privacy-policy', 'pl')).toBe('/polityka-prywatnosci');
    expect(switchLocalePath('/zh/watch/abc', 'fr')).toBe('/fr/watch/abc');
    expect(switchLocalePath('/regulamin', 'es')).toBe('/es/terms');
    expect(switchLocalePath('/', 'pt')).toBe('/pt');
  });

  it('point search engines at the English page (their content is English) and are not in the sitemap languages', () => {
    const alternates = getLocaleAlternates('de', 'search', { baseUrl: 'https://x.test' });
    expect(alternates.canonical).toBe('https://x.test/en/search');
    expect(Object.keys(alternates.languages)).toEqual(['pl', 'en', 'x-default']);
    expect(toContentLocale('zh')).toBe('en');
    expect(toContentLocale('pl')).toBe('pl');
  });

  it('are public in the proxy and keep their prefix instead of being rewritten to /pl', () => {
    const source = middleware();
    expect(source).toContain('UI_ONLY_PUBLIC_ROUTES');
    expect(source).toContain('SUPPORTED_LOCALES.join');
    for (const locale of UI_ONLY_LOCALES) expect(getRouteLocaleFromPathname(`/${locale}/search`)).toBe(locale);
    expect(getRouteLocaleFromPathname('/ja/search')).toBeNull();
    expect(isLocale('de')).toBe(true);
    expect(isLocale('DE')).toBe(false);
  });
});

describe('My subscriptions route', () => {
  it('has a Polish and an English path, mirrored for the UI-only languages', () => {
    expect(getLocalizedHref('pl', 'subscriptions')).toBe('/subskrypcje');
    expect(getLocalizedHref('en', 'subscriptions')).toBe('/en/subscriptions');
    expect(getLocalizedHref('de', 'subscriptions')).toBe('/de/subscriptions');
  });

  it('is kept by the language switcher and the legacy-path mapping', () => {
    expect(switchLocalePath('/subskrypcje', 'en')).toBe('/en/subscriptions');
    expect(switchLocalePath('/pl/subskrypcje', 'de')).toBe('/de/subscriptions');
    expect(switchLocalePath('/en/subscriptions', 'pl')).toBe('/subskrypcje');
    expect(switchLocalePath('/de/subscriptions', 'en')).toBe('/en/subscriptions');
    expect(localizedPathFromLegacyPath('/subskrypcje', 'en')).toBe('/en/subscriptions');
  });
});
