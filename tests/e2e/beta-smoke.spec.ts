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
  adminStorageState: process.env.E2E_ADMIN_STORAGE_STATE,
  commentVideoId:
    process.env.E2E_COMMENT_VIDEO_ID ||
    process.env.E2E_PUBLIC_VIDEO_ID ||
    "v_fallback_001",
  adminCrudVideoUrl:
    process.env.E2E_ADMIN_CRUD_VIDEO_URL ||
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  adminCrudThumbnailUrl:
    process.env.E2E_ADMIN_CRUD_THUMBNAIL_URL ||
    "/qr-code-placeholder.png",
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

async function expectUnauthorizedOrForbidden(response: APIResponse) {
  expect(
    response.status(),
    "protected API should reject callers without the required access",
  ).toBeGreaterThanOrEqual(401);
  expect(response.status()).toBeLessThan(500);
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

  test("guest comment mutation is blocked", async ({ request }) => {
    const response = await request.post("/api/comments", {
      data: { videoId: e2e.publicVideoId, text: "guest smoke comment" },
    });

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  test("share popover opens on desktop", async ({ page }) => {
    // Navigate to a page with a video (hero has the share button)
    await page.goto("/");

    // The share button is identified by aria-label "Udostępnij"
    const shareButton = page.getByLabel("Udostępnij");
    await expect(shareButton).toBeVisible();

    // On desktop, it should open a popover
    await shareButton.click();

    const popover = page.locator('text=Kopiuj link');
    await expect(popover).toBeVisible();
    await expect(page.locator('text=Udostępnij na X')).toBeVisible();
    await expect(page.locator('text=Udostępnij na Facebook')).toBeVisible();

    // Clicking "Kopiuj link" should change text to "Skopiowano!"
    await popover.click();
    await expect(page.locator('text=Skopiowano!')).toBeVisible();
  });

  test("guest checkout smoke is blocked before payment creation", async ({
    request,
  }) => {
    const response = await request.post("/api/checkout/create-intent", {
      data: {
        amountMinor: 2000,
        currency: "PLN",
        title: "E2E smoke tip",
        requestId: "00000000-0000-4000-8000-000000000001",
      },
    });

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Unauthorized");
  });

  test("guest admin API is blocked", async ({ request }) => {
    const response = await request.get("/api/admin/videos");

    await expectUnauthorizedOrForbidden(response);
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

  test("non-patron can comment on public material", async ({ request }) => {
    const response = await request.post("/api/comments", {
      data: {
        videoId: e2e.commentVideoId,
        text: `E2E smoke comment ${Date.now()}`,
      },
    });

    expect(response.status(), "public comment smoke should be accepted").toBe(
      201,
    );

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.comment?.id).toEqual(expect.any(String));
  });

  test("non-patron cannot comment on patron-only material", async ({
    request,
  }) => {
    const response = await request.post("/api/comments", {
      data: {
        videoId: e2e.patronVideoId,
        text: `E2E patron-denied comment ${Date.now()}`,
      },
    });

    expect(response.status()).toBe(403);

    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.message).toMatch(/Patron|Brak uprawnień/i);
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

test.describe("beta smoke: admin access", () => {
  test.use({ storageState: e2e.adminStorageState });

  test.beforeEach(() => {
    test.skip(
      !e2e.adminStorageState,
      "ENV blocked: set E2E_ADMIN_STORAGE_STATE for admin smoke.",
    );
  });

  test("admin can reach video management API", async ({ request }) => {
    const response = await request.get("/api/admin/videos");

    expect(
      response.status(),
      "admin video API should be reachable",
    ).toBeLessThan(500);
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual(expect.any(Array));
  });

  test("admin can resync subscriber counts", async ({ request }) => {
    const response = await request.post("/api/admin/subscribers/resync");
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.updated).toEqual(expect.any(Array));
  });

  test("admin can create, update, and archive a draft video through the API", async ({ request }) => {
    const slug = `e2e-beta-crud-${Date.now()}`;
    let createdId: string | undefined;

    const basePayload = {
      title: "E2E beta CRUD draft",
      slug,
      description: "Temporary beta smoke video created by Playwright.",
      videoUrl: e2e.adminCrudVideoUrl,
      thumbnailUrl: e2e.adminCrudThumbnailUrl,
      duration: "00:30",
      tier: "PUBLIC",
      status: "DRAFT",
      isMainFeatured: false,
      showInSidebar: false,
      sidebarOrder: 9999,
    };

    try {
      const createResponse = await request.post("/api/admin/videos", {
        data: basePayload,
      });
      expect(createResponse.status(), "admin should create a draft video").toBe(200);
      const created = await createResponse.json();
      createdId = created.id;
      expect(created.id).toEqual(expect.any(String));
      expect(created.status).toBe("DRAFT");

      const updateResponse = await request.post("/api/admin/videos", {
        data: {
          ...basePayload,
          id: createdId,
          title: "E2E beta CRUD draft updated",
          description: "Updated by Playwright beta smoke.",
        },
      });
      expect(updateResponse.status(), "admin should update the draft video").toBe(200);
      const updated = await updateResponse.json();
      expect(updated.id).toBe(createdId);
      expect(updated.title).toBe("E2E beta CRUD draft updated");

      const archiveResponse = await request.delete(`/api/admin/videos?id=${createdId}`);
      expect(archiveResponse.status(), "admin should archive the draft video").toBe(200);
      const archived = await archiveResponse.json();
      expect(archived.success).toBe(true);
      expect(archived.status).toBe("ARCHIVED");
      createdId = undefined;
    } finally {
      if (createdId) {
        await request.delete(`/api/admin/videos?id=${createdId}`);
      }
    }
  });
});
