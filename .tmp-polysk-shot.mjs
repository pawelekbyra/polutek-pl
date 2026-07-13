import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 1160, height: 900 } });
page.on('pageerror', (err) => console.log('[pageerror]', err.message));
await page.goto('http://localhost:8936/preview.html');
await page.waitForTimeout(600);
await page.screenshot({ path: 'polysk-preview.png', fullPage: true });
console.log('done');
await browser.close();
