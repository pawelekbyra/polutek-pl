import { PrismaClient } from "@prisma/client";
import { serializeSignedCookie } from "better-call";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const prisma = new PrismaClient();
const run = `k22-browser-${Date.now().toString(36)}`;
const userId = `${run}-user`;
const token = `${run}-session-token`;
let creatorId = "";
let signedCookie = "";

async function seedSession() {
  await prisma.user.create({ data: { id: userId, email: `${run}@example.test`, emailVerified: true, name: "K22 Browser" } });
  const creator = await prisma.creator.create({ data: { userId, slug: run, name: "K22 Browser" } });
  creatorId = creator.id;
  await prisma.session.create({ data: { id: `${run}-session`, token, userId, expiresAt: new Date(Date.now() + 60 * 60_000) } });
  const secret = process.env.BETTER_AUTH_SECRET ?? "build-or-dev-only-secret-change-me-0123456789abcdef";
  signedCookie = (await serializeSignedCookie("pp.session_token", token, secret, { path: "/", httpOnly: true, sameSite: "lax" })).split(";")[0].split("=").slice(1).join("=");
}

test.beforeAll(async () => seedSession());
test.afterAll(async () => {
  await prisma.creator.deleteMany({ where: { id: creatorId } });
  await prisma.session.deleteMany({ where: { userId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

test("Studio resumes stored parts in a second tab without creating or uploading them again", async ({ page, context, baseURL }) => {
  expect(baseURL).toBeTruthy();
  const host = new URL(baseURL!).hostname;
  await addSessionCookie(context, host);

  let uploadStarts = 0;
  let draftChecks = 0;
  let draftCreates = 0;
  let partLists = 0;
  let partPuts = 0;
  let completions = 0;
  const installRoutes = async (targetPage: Page) => {
    await targetPage.route("**/api/studio/me", (route) => route.fulfill({ json: {
      channel: { id: creatorId, slug: run, handle: null, name: "K22 Browser", status: "ACTIVE", isVerified: false, language: "pl", country: "PL" },
      channels: [], channelCreation: "off", limits: null,
    } }));
    await targetPage.route("**/api/studio/comments**", (route) => route.fulfill({ json: { items: [], total: 0, counts: { held: 0 } } }));
    await targetPage.route("**/api/studio/videos**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const method = request.method();
      if (url.pathname === "/api/studio/videos" && method === "GET") return route.fulfill({ json: { items: [], total: 0, page: 1, totalPages: 0 } });
      if (url.pathname === "/api/studio/videos" && method === "POST") { draftCreates += 1; return route.fulfill({ json: { id: "draft-k22" } }); }
      if (url.pathname === "/api/studio/videos/draft-k22" && method === "GET") { draftChecks += 1; return route.fulfill({ json: { id: "draft-k22" } }); }
      if (url.pathname === "/api/studio/videos/draft-k22/upload" && method === "POST") {
        uploadStarts += 1;
        return route.fulfill({ json: { originalId: "original-k22", partSize: 64 * 1024, partCount: 1, fileSize: 8 } });
      }
      if (url.pathname === "/api/studio/videos/draft-k22/upload" && method === "GET") {
        partLists += 1;
        return route.fulfill({ json: { parts: [{ partNumber: 1, etag: '"etag-k22"' }], partSize: 64 * 1024, partCount: 1 } });
      }
      if (url.pathname === "/api/studio/videos/draft-k22/upload/parts" && method === "POST") return route.fulfill({ json: { urls: [{ partNumber: 1, url: `${url.origin}/__r2/mock/k22-part-1` }] } });
      if (url.pathname === "/api/studio/videos/draft-k22/upload/complete" && method === "POST") {
        completions += 1;
        if (completions === 1) return route.fulfill({ status: 502, json: { error: "temporary failure", code: "TEMPORARY_FAILURE" } });
        return route.fulfill({ json: { originalId: "original-k22", job: { id: "job-k22" } } });
      }
      return route.fulfill({ status: 404, json: { error: "unhandled Studio API request", code: "NOT_FOUND" } });
    });
    await targetPage.route("**/__r2/mock/**", async (route) => {
      partPuts += 1;
      return route.fulfill({ status: 200, headers: { etag: '"etag-k22"' } });
    });
  };
  await installRoutes(page);

  await page.goto("/pl/studio");
  await page.getByRole("button", { name: /Treści|Content/ }).click();
  await page.getByRole("button", { name: /Prześlij film|Upload a video/ }).click();
  await selectStableSampleFile(page);
  const firstIdentity = await browserFileIdentity(page);
  await page.locator("#wz-title").fill("K22 test");
  await page.getByText(/^(Dalej|Next)$/, { exact: true }).click();
  await page.getByRole("button", { name: /Rozpocznij przesyłanie|Start upload/ }).click();
  await expect(page.getByText(/Przesyłanie zatrzymane|Upload stopped/)).toBeVisible();
  expect({ uploadStarts, partLists, partPuts, completions }).toEqual({ uploadStarts: 1, partLists: 0, partPuts: 1, completions: 1 });
  expect(partPuts).toBe(1);
  expect(completions).toBe(1);
  const resumeState = await page.evaluate(() => Object.keys(localStorage));
  expect(resumeState.some((key) => key.startsWith("studio-upload-draft:v1:"))).toBe(true);

  // Keep the first tab open and resume from another tab sharing the same origin storage.
  const secondTab = await context.newPage();
  await installRoutes(secondTab);
  await secondTab.goto("/pl/studio?section=content");
  expect(await secondTab.evaluate(() => Object.keys(localStorage))).toEqual(resumeState);
  await secondTab.getByRole("button", { name: /Prześlij film|Upload a video/ }).click();
  await selectStableSampleFile(secondTab);
  expect(await browserFileIdentity(secondTab)).toBe(firstIdentity);
  await secondTab.locator("#wz-title").fill("K22 test");
  await secondTab.getByText(/^(Dalej|Next)$/, { exact: true }).click();
  await secondTab.getByRole("button", { name: /Rozpocznij przesyłanie|Start upload/ }).click();
  await expect.poll(() => completions).toBe(2);
  expect({ draftCreates, uploadStarts }).toEqual({ draftCreates: 1, uploadStarts: 1 });
  expect(draftChecks).toBeGreaterThanOrEqual(1);
  expect(partLists).toBe(1);
  expect(partPuts).toBe(1);
  expect(completions).toBe(2);
});

async function addSessionCookie(context: BrowserContext, host: string) {
  await context.addCookies([{ name: "pp.session_token", value: signedCookie, domain: host, path: "/", httpOnly: true, sameSite: "Lax" }]);
}

async function browserFileIdentity(page: import("@playwright/test").Page): Promise<string> {
  return page.locator("#wz-file").evaluate(async (element) => {
    const file = (element as HTMLInputElement).files?.[0];
    if (!file) throw new Error("No selected file");
    const starts = [0, 0.25, 0.5, 0.75, 1].map((fraction) => Math.min(Math.max(0, file.size - 32 * 1024), Math.floor((file.size - 32 * 1024) * fraction)));
    const chunks = await Promise.all(starts.map(async (start) => new Uint8Array(await file.slice(start, start + 32 * 1024).arrayBuffer())));
    const metadata = new TextEncoder().encode(`${file.name}\0${file.size}\0${file.lastModified}\0`);
    const sample = new Uint8Array(metadata.length + chunks.reduce((total, chunk) => total + chunk.length, 0));
    sample.set(metadata);
    let offset = metadata.length;
    for (const chunk of chunks) { sample.set(chunk, offset); offset += chunk.length; }
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", sample));
    return `${file.name}:${file.size}:${file.lastModified}:${[...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  });
}

async function selectStableSampleFile(page: import("@playwright/test").Page) {
  await page.locator("#wz-file").evaluate((element) => {
    const input = element as HTMLInputElement;
    const transfer = new DataTransfer();
    transfer.items.add(new File(["12345678"], "sample.mp4", { type: "video/mp4", lastModified: 1 }));
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
