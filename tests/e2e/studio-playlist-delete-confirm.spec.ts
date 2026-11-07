import { createHmac, randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { expect, test, type BrowserContext } from "@playwright/test";

const prisma = new PrismaClient();
const run = `k34-studio-${Date.now().toString(36)}`;
const userId = `${run}-user`;
const token = randomBytes(32).toString("base64url");
const secret = process.env.BETTER_AUTH_SECRET ?? "build-or-dev-only-secret-change-me-0123456789abcdef";
let creatorId = "";
let playlistId = "";
let cookieValue = "";

test.beforeAll(async () => {
  await prisma.user.create({ data: { id: userId, email: `${run}@example.test`, emailVerified: true, name: "K34 Studio" } });
  const creator = await prisma.creator.create({ data: { userId, slug: run, name: "K34 Studio", status: "ACTIVE" } });
  creatorId = creator.id;
  await prisma.appSetting.create({ data: { key: "main_channel_id", value: creatorId } });
  await prisma.channelMember.create({ data: { channelId: creatorId, userId, role: "OWNER", acceptedAt: new Date() } });
  await prisma.playlist.create({
    data: { channelId: creatorId, title: "K34 delete flow", slug: `${run}-playlist`, visibility: "PRIVATE" },
  }).then((playlist) => { playlistId = playlist.id; });
  await prisma.session.create({ data: {
    id: `${run}-session`, token, userId, expiresAt: new Date(Date.now() + 60 * 60_000),
  } });
  const signature = createHmac("sha256", secret).update(token).digest("base64");
  cookieValue = `${token}.${signature}`;
});

test.afterAll(async () => {
  // AuditLog is append-only; this E2E uses a disposable PostgreSQL database that is dropped after the run.
  if (creatorId) await prisma.creator.deleteMany({ where: { id: creatorId } });
  await prisma.appSetting.deleteMany({ where: { key: "main_channel_id", value: creatorId } });
  await prisma.session.deleteMany({ where: { userId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  cookieValue = "";
  await prisma.$disconnect();
});

test("Studio playlist delete keeps busy focus contained, retries, and calls the real DELETE route", async ({ page, context, baseURL }) => {
  expect(baseURL).toBeTruthy();
  await addSessionCookie(context, new URL(baseURL!).hostname);
  page.on("pageerror", (error) => console.log(`[K34] page error: ${error.message}`));
  await page.goto("/pl/studio?section=playlists");
  await expect(page.getByText("Czy chcesz subskrybować?")).toBeVisible();
  await page.getByRole("button", { name: /^nie$/i }).click();
  await page.getByRole("button", { name: "Playlisty", exact: true }).click();
  await page.getByRole("button", { name: "Edytuj" }).click();
  await expect(page.getByLabel("Tytuł")).toHaveValue("K34 delete flow");

  let deleteCalls = 0;
  let actualDeleteStatus: number | null = null;
  await page.route(`**/api/studio/playlists/${playlistId}`, async (route) => {
    deleteCalls += 1;
    if (deleteCalls === 1) {
      await route.fulfill({ status: 500, json: { error: "Błąd serwera. Spróbuj ponownie.", code: "DATABASE_ERROR" } });
      return;
    }
    const response = await route.fetch();
    actualDeleteStatus = response.status();
    await page.waitForTimeout(1_000);
    await route.fulfill({ response });
  });

  await page.getByRole("button", { name: "Usuń playlistę" }).click();
  let dialog = page.getByRole("alertdialog", { name: "Usunąć playlistę?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Usuń playlistę" }).click();
  await expect(page.getByText("Błąd serwera. Spróbuj ponownie.")).toBeVisible();
  await expect(dialog).toHaveCount(0);
  expect(deleteCalls).toBe(1);

  await page.getByRole("button", { name: "Usuń playlistę" }).click();
  dialog = page.getByRole("alertdialog", { name: "Usunąć playlistę?" });
  await dialog.getByRole("button", { name: "Usuń playlistę" }).click();
  await expect(dialog).toHaveAttribute("aria-busy", "true");
  await expect(dialog.getByRole("status")).toContainText("Operacja w toku.");

  await page.keyboard.press("Tab");
  await expect.poll(() => dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Shift+Tab");
  await expect.poll(() => dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Enter");
  await expect(dialog).toBeVisible();
  expect({ deleteCalls, actualDeleteStatus }).toEqual({ deleteCalls: 2, actualDeleteStatus: 200 });

  await expect(dialog).toHaveCount(0);
  await expect(page.getByText(/Nie masz jeszcze playlist/)).toBeVisible();
  await expect.poll(async () => (await prisma.playlist.findUnique({ where: { id: playlistId } }))?.deletedAt).toBeInstanceOf(Date);
  await expect.poll(() => prisma.auditLog.count({ where: { action: "PLAYLIST_DELETED", targetId: playlistId, channelId: creatorId } })).toBe(1);
  await expect.poll(() => page.evaluate(() => {
    const active = document.activeElement;
    return active?.tagName === "H1" || active?.getAttribute("role") === "main" || active?.tagName === "MAIN";
  })).toBe(true);
});

async function addSessionCookie(context: BrowserContext, host: string) {
  await context.addCookies([{ name: "pp.session_token", value: cookieValue, domain: host, path: "/", httpOnly: true, sameSite: "Lax" }]);
}
