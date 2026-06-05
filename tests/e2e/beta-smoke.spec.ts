import { expect, test } from '@playwright/test';

const creatorSlug = process.env.E2E_CREATOR_SLUG || process.env.MAIN_CREATOR_SLUG;
const patronStorageState = process.env.E2E_PATRON_STORAGE_STATE;
const subscriberStorageState = process.env.E2E_SUBSCRIBER_STORAGE_STATE;

async function expectNonServerError(status: number | null) {
  expect(status, 'route should respond before browser assertions').not.toBeNull();
  expect(status ?? 500, 'route must not return a server error').toBeLessThan(500);
}

test.describe('beta public smoke', () => {
  test('homepage renders without server errors', async ({ page }) => {
    const response = await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expectNonServerError(response?.status() ?? null);
    await expect(page).toHaveTitle(/Kraufanding|VOD/i);
    await expect(page.locator('body')).toContainText(/Kraufanding|VOD|kanał|film|materiał/i);
  });

  test('configured channel page renders without server errors', async ({ page }) => {
    test.skip(!creatorSlug, 'Set E2E_CREATOR_SLUG or MAIN_CREATOR_SLUG to smoke the configured channel page.');

    const response = await page.goto(`/channel/${creatorSlug}`, { waitUntil: 'domcontentloaded' });

    await expectNonServerError(response?.status() ?? null);
    await expect(page.locator('body')).toContainText(new RegExp(`@?${creatorSlug}`, 'i'));
    await expect(page.locator('body')).toContainText(/Subskrybuj|Subskrybowano|film|kanał/i);
  });

  test('guest admin visit does not expose the admin dashboard', async ({ page }) => {
    const response = await page.goto('/admin', { waitUntil: 'domcontentloaded' });

    await expectNonServerError(response?.status() ?? null);
    await expect(page.locator('body')).not.toContainText(/Panel administracyjny|Zarządzaj kanałem/i);
  });
});

test.describe('beta authenticated smoke', () => {
  test.use({ storageState: subscriberStorageState });

  test('subscriber can open the configured channel and see subscription UI', async ({ page }) => {
    test.skip(!creatorSlug, 'Set E2E_CREATOR_SLUG or MAIN_CREATOR_SLUG to smoke subscriptions.');
    test.skip(!subscriberStorageState, 'Set E2E_SUBSCRIBER_STORAGE_STATE for authenticated subscription smoke.');

    const response = await page.goto(`/channel/${creatorSlug}`, { waitUntil: 'domcontentloaded' });

    await expectNonServerError(response?.status() ?? null);
    await expect(page.getByRole('button', { name: /Subskrybuj|Subskrybowano/i })).toBeVisible();
  });
});

test.describe('beta patron and media smoke', () => {
  test.use({ storageState: patronStorageState });

  test('patron session can request configured media source endpoint', async ({ request }) => {
    const videoId = process.env.E2E_PATRON_VIDEO_ID;
    test.skip(!patronStorageState, 'Set E2E_PATRON_STORAGE_STATE for authenticated patron smoke.');
    test.skip(!videoId, 'Set E2E_PATRON_VIDEO_ID to smoke media-source access.');

    const response = await request.get(`/api/media-source/${videoId}`);

    expect(response.status(), 'patron media-source request should not fail server-side').toBeLessThan(500);
    expect([200, 403, 404], 'media-source should return an explicit access/data decision').toContain(response.status());
  });
});
