import { describe, expect, it } from 'vitest';
import { appendQueryString, getLocalizedHref, localizedPathFromLegacyPath, switchLocalePath } from '@/lib/i18n/routing';
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
