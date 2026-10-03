#!/usr/bin/env node
/**
 * Generuje logo/favicony marki "Support" z public/logo-glasses.svg (nasz znak okularow).
 * Wyniki sa w assets/ i sa commitowane; deploy.mjs nie wymaga sharp.
 *   node workers/support-brand/gen-assets.mjs        (wymaga `npm i` w repo: sharp)
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = path.dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(await readFile(path.join(here, 'brand.config.json'), 'utf8'));
const src = await readFile(path.join(here, '../../public/logo-glasses.svg'), 'utf8');
const inner = src.replace(/<\?xml[^>]*>/, '').replace(/<svg[^>]*>/, '').replace('</svg>', '').trim();
const recolor = (s, dark, light) => s.replace(/#272727|#292929/g, dark).replace(/#FEFEFE/gi, light);
const GW = 2048, GH = 506;
const label = cfg.shortName.replace(/^PP\s*/, '') || 'Support';

// Logo poziome: okulary + napis (napis jako tekst systemowy: <img> nie laduje fontow webowych).
const h = 56, scale = h / GH, gw = Math.round(GW * scale);
const logo = (dark, light, text) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${gw + 150} 64" width="${gw + 150}" height="64">
<g transform="translate(0,4) scale(${scale.toFixed(5)})">${recolor(inner, dark, light)}</g>
<text x="${gw + 14}" y="43" font-family="Geist, 'Segoe UI', system-ui, -apple-system, Arial, sans-serif" font-size="30" font-weight="600" letter-spacing="-0.5" fill="${text}">${label}</text>
</svg>
`;
await writeFile(path.join(here, 'assets/logo.svg'), logo('#272727', '#fefefe', '#111827'));
await writeFile(path.join(here, 'assets/logo-dark.svg'), logo('#f5f5f5', '#272727', '#f5f5f5'));

// Znaczek kwadratowy: niebieski kafelek z bialymi okularami.
const pad = 96, tw = 512 - 2 * pad, ts = tw / GW, ty = (512 - GH * ts) / 2;
const thumb = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
<rect width="512" height="512" rx="112" fill="${cfg.accent}"/>
<g transform="translate(${pad},${ty.toFixed(2)}) scale(${ts.toFixed(5)})">${recolor(inner, '#ffffff', cfg.accent)}</g>
</svg>
`;
await writeFile(path.join(here, 'assets/logo-thumbnail.svg'), thumb);
for (const n of [32, 96, 180, 192, 512]) {
  await sharp(Buffer.from(thumb)).resize(n, n).png().toFile(path.join(here, `assets/icon-${n}.png`));
}
console.log('assets ok');

// Kopie do nadpisania plikow statycznych panelu (montowane woluminem, zob. docker-compose.yml).
import { copyFile, mkdir } from 'node:fs/promises';
const pub = path.join(here, '../../deploy/serwerek/support/overrides/public');
await mkdir(path.join(pub, 'brand-assets'), { recursive: true });
await copyFile(path.join(here, 'assets/logo.svg'), path.join(pub, 'brand-assets/logo.svg'));
await copyFile(path.join(here, 'assets/logo-dark.svg'), path.join(pub, 'brand-assets/logo_dark.svg'));
await copyFile(path.join(here, 'assets/logo-thumbnail.svg'), path.join(pub, 'brand-assets/logo_thumbnail.svg'));
await copyFile(path.join(here, 'assets/icon-192.png'), path.join(pub, 'android-icon-192x192.png'));
await writeFile(path.join(pub, 'manifest.json'), JSON.stringify({
  name: cfg.name, short_name: cfg.shortName, start_url: '/app/', display: 'standalone',
  background_color: '#f0f3f8', theme_color: cfg.accent,
  icons: [{ src: '/pp-support/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/pp-support/icon-512.png', sizes: '512x512', type: 'image/png' }],
}, null, 2) + '\n');
console.log('overrides/public ok');
