import { describe, expect, it } from 'vitest';
import { appendQueryString, getLocalizedHref, localizedPathFromLegacyPath, switchLocalePath } from '@/lib/i18n/routing';
import { readFileSync } from 'node:fs';

const middleware = () => readFileSync('middleware.ts', 'utf8');

describe('locale-first public routing', () => {
  it('builds localized hrefs and preserves query strings', () => {
    expect(getLocalizedHref('pl', 'watch', { slug: 'film-test' })).toBe('/pl/watch/film-test');
    expect(getLocalizedHref('en', 'shop')).toBe('/en/shop');
    expect(appendQueryString('/en/search', 'q=test')).toBe('/en/search?q=test');
  });

  it('maps legacy public paths to locale-prefixed equivalents', () => {
    expect(localizedPathFromLegacyPath('/watch/some-slug', 'pl')).toBe('/pl/watch/some-slug');
    expect(localizedPathFromLegacyPath('/channel/main', 'en')).toBe('/en/channel/main');
    expect(localizedPathFromLegacyPath('/regulamin', 'en')).toBe('/en/terms');
    expect(localizedPathFromLegacyPath('/polityka-prywatnosci', 'pl')).toBe('/pl/polityka-prywatnosci');
    expect(localizedPathFromLegacyPath('/shop', 'pl')).toBe('/pl/sklep');
  });

  it('switches between equivalent localized public routes', () => {
    expect(switchLocalePath('/pl/watch/my-video', 'en')).toBe('/en/watch/my-video');
    expect(switchLocalePath('/en/shop', 'pl')).toBe('/pl/sklep');
    expect(switchLocalePath('/pl/regulamin', 'en')).toBe('/en/terms');
  });

  it('keeps localized public routes public without exposing admin routes', () => {
    const source = middleware();
    for (const route of ['/pl/watch/(.*)', '/en/watch/(.*)', '/pl/sklep', '/en/shop']) {
      expect(source).toContain(route);
    }
    expect(source).toContain("const isAdminRoute = createRouteMatcher(['/admin(.*)', '/api/admin(.*)']);");
  });
});
