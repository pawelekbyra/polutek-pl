import { expect, test, type APIResponse } from "@playwright/test";

const e2e = {
  creatorSlug:
    process.env.E2E_CREATOR_SLUG ||
    process.env.MAIN_CREATOR_SLUG ||
    "main-creator",
  publicVideoId: process.env.E2E_PUBLIC_VIDEO_ID || "v_fallback_001",
  loggedInVideoId: process.env.E2E_LOGGED_IN_VIDEO_ID || "v_fallback_002",
  patronVideoId: process.env.E2E_PATRON_VIDEO_ID || "v_fallback_003",
  nonPatronStorageState:
    process.env.E2E_NON_PATRON_STORAGE_STATE ||
    process.env.E2E_SUBSCRIBER_STORAGE_STATE,
};

async function expectNonServerError(status: number | null) {
  expect(
    status,
    "route should respond before browser assertions",
  ).not.toBeNull();
  expect(status ?? 500, "route must not return a server error").toBeLessThan(
    500,
  );
}

async function expectMediaSourceDenied(response: APIResponse) {
  expect(
    response.status(),
    "media-source should make an explicit access decision",
  ).toBe(403);
  const body = await response.json();
  expect(body.hasAccess).toBe(false);
  expect(
    body.playbackUrl,
    "denied media-source responses must not leak playback URLs",
  ).toBeUndefined();
  expect(
    body.url,
    "denied media-source responses must not leak raw URLs",
  ).toBeUndefined();
}

test.describe("beta smoke: guest/public access", () => {
  test("homepage works", async ({ page }) => {
    const response = await page.goto("/", { waitUntil: "domcontentloaded" });

    await expectNonServerError(response?.status() ?? null);
    await expect(page).toHaveTitle(/Polutek|VOD/i);
    await expect(page.locator("body")).toContainText(
      /Polutek|VOD|kanał|film|materiał|Brak materiałów/i,
    );
  });

  test("/channel/[MAIN_CREATOR_SLUG] works", async ({ page }) => {
    const response = await page.goto(`/channel/${e2e.creatorSlug}`, {
      waitUntil: "domcontentloaded",
    });

    await expectNonServerError(response?.status() ?? null);
    await expect(page.locator("body")).toContainText(
      new RegExp(`@?${e2e.creatorSlug}|Kanał nie znaleziony`, "i"),
    );
  });

  test("public video is available for a guest", async ({ page, request }) => {
    const response = await page.goto(`/?v=${e2e.publicVideoId}`, {
      waitUntil: "domcontentloaded",
    });

    await expectNonServerError(response?.status() ?? null);
    const sourceResponse = await request.get(
      `/api/media-source/${e2e.publicVideoId}`,
    );
    expect(sourceResponse.status()).toBe(200);
    const source = await sourceResponse.json();
    expect(source.hasAccess).toBe(true);
    expect(
      source.playbackUrl,
      "public media-source should expose a playable URL",
    ).toEqual(expect.any(String));
  });

  test("logged-in video blocks a guest", async ({ page, request }) => {
    const response = await page.goto(`/?v=${e2e.loggedInVideoId}`, {
      waitUntil: "domcontentloaded",
    });

    await expectNonServerError(response?.status() ?? null);
    await expect(page.locator("body")).toContainText(
      /Zaloguj|Log in|Access Restricted/i,
    );

    const sourceResponse = await request.get(
      `/api/media-source/${e2e.loggedInVideoId}`,
    );
    await expectMediaSourceDenied(sourceResponse);
  });

  test("patron video blocks a guest", async ({ page, request }) => {
    const response = await page.goto(`/?v=${e2e.patronVideoId}`, {
      waitUntil: "domcontentloaded",
    });

    await expectNonServerError(response?.status() ?? null);
    await expect(page.locator("body")).toContainText(
      /Patron|Access Restricted|Strefa/i,
    );

    const sourceResponse = await request.get(
      `/api/media-source/${e2e.patronVideoId}`,
    );
    await expectMediaSourceDenied(sourceResponse);
  });

  test("guest admin visit does not expose the admin dashboard", async ({
    page,
  }) => {
    const response = await page.goto("/admin", {
      waitUntil: "domcontentloaded",
    });

    await expectNonServerError(response?.status() ?? null);
    await expect(page.locator("body")).not.toContainText(
      /Panel administracyjny|Zarządzaj kanałem|Admin dashboard/i,
    );
  });

  test("media-source does not return a source without access", async ({
    request,
  }) => {
    const response = await request.get(
      `/api/media-source/${e2e.patronVideoId}`,
    );

    await expectMediaSourceDenied(response);
  });
});

test.describe("beta smoke: authenticated non-patron access", () => {
  test.use({ storageState: e2e.nonPatronStorageState });

  test.beforeEach(() => {
    test.skip(
      !e2e.nonPatronStorageState,
      "ENV blocked: set E2E_NON_PATRON_STORAGE_STATE or E2E_SUBSCRIBER_STORAGE_STATE for non-patron smoke.",
    );
  });

  test("patron video blocks a non-patron", async ({ page, request }) => {
    const response = await page.goto(`/?v=${e2e.patronVideoId}`, {
      waitUntil: "domcontentloaded",
    });

    await expectNonServerError(response?.status() ?? null);
    await expect(page.locator("body")).toContainText(/Patron|Strefa/i);

    const sourceResponse = await request.get(
      `/api/media-source/${e2e.patronVideoId}`,
    );
    await expectMediaSourceDenied(sourceResponse);
  });

  test("subscription does not give Patron access", async ({
    page,
    request,
  }) => {
    const channelResponse = await page.goto(`/channel/${e2e.creatorSlug}`, {
      waitUntil: "domcontentloaded",
    });

    await expectNonServerError(channelResponse?.status() ?? null);
    await expect(page.locator("body")).toContainText(
      /Subskrybuj|Subskrybowano|Subscribe|Subscribed/i,
    );

    const sourceResponse = await request.get(
      `/api/media-source/${e2e.patronVideoId}`,
    );
    await expectMediaSourceDenied(sourceResponse);
  });

  test("admin route blocks a regular user", async ({ page }) => {
    const response = await page.goto("/admin", {
      waitUntil: "domcontentloaded",
    });

    await expectNonServerError(response?.status() ?? null);
    await expect(page.locator("body")).not.toContainText(
      /Panel administracyjny|Zarządzaj kanałem|Admin dashboard/i,
    );
  });
});
