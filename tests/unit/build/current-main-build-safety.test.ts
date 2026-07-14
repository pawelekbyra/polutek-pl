import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

const activeBuildFiles = [
  'app/layout.tsx',
  'app/globals.css',
  'app/sitemap.ts',
  'app/robots.ts',
  'app/components/ClerkLocalizationProvider.tsx',
  'app/components/Providers.tsx',
  'scripts/validate-env.ts',
];

describe('current main build safety', () => {
  it('does not use build-time Google font modules or remote CSS font imports', () => {
    expect(read('app/layout.tsx')).not.toContain('next/font/google');
    expect(read('app/globals.css')).not.toMatch(/@import\s+[^;]*fonts\.googleapis\.com/i);
  });

  it('uses bundled Geist font variables instead of remote font hooks', () => {
    const fonts = read('app/fonts.ts');
    const layout = read('app/layout.tsx');

    expect(fonts).toContain('from "geist/font/sans"');
    expect(fonts).toContain('from "geist/font/mono"');
    expect(layout).toContain('geistSans.variable');
    expect(layout).toContain('geistMono.variable');
  });

  it('keeps sitemap output limited to public page URLs without private/provider fields', () => {
    const source = read('app/sitemap.ts');

    expect(source).toContain('getSitemapVideos');
    expect(source).toContain('catch(() => [])');
    expect(source).toContain('getLocalizedHref');

    for (const forbidden of [
      'playbackUrl',
      'playbackToken',
      'signedUrl',
      'sourceUrl',
      'providerUrl',
      'providerId',
      'cloudflare',
      'mux',
      'token',
    ]) {
      expect(source.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });

  it('does not add fake Clerk keys, secrets, or database URLs to active build files', () => {
    const source = activeBuildFiles.map((file) => read(file)).join('\n');

    expect(source).not.toMatch(/pk_(test|live)_[A-Za-z0-9_$-]+/);
    expect(source).not.toMatch(/sk_(test|live)_[A-Za-z0-9_$-]+/);
    expect(source).not.toMatch(/postgres(?:ql)?:\/\//i);
    expect(source).not.toMatch(/mysql:\/\//i);
    expect(source).not.toMatch(/mongodb(?:\+srv)?:\/\//i);
  });

  it('does not introduce external provider calls at module scope in build-critical modules', () => {
    const sitemapSource = read('app/sitemap.ts');
    const beforeDefaultExport = sitemapSource.split('export default async function sitemap')[0];

    expect(beforeDefaultExport).not.toMatch(/await\s+/);
    expect(beforeDefaultExport).not.toMatch(/fetch\s*\(/);
    expect(beforeDefaultExport).not.toMatch(/prisma\.[a-zA-Z]+\./);
    expect(beforeDefaultExport).not.toMatch(/getSitemapVideos\s*\(/);
    expect(beforeDefaultExport).not.toMatch(/getConfiguredOrDefaultCreator\s*\(/);
  });
});
