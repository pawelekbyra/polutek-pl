import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { notificationTemplates, sendNotification } from "@/lib/modules/notifications/application/send-notification.use-case";

function fakeDb(override: unknown = null) {
  const create = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: "n1", ...data }));
  const db = {
    notificationPreference: { findUnique: vi.fn().mockResolvedValue(null) },
    notificationTemplate: { findUnique: vi.fn().mockResolvedValue(override) },
    notification: { create },
  };
  return { db: db as never, create };
}

const t = notificationTemplates.welcome;
const base = { userId: "u1", kind: t.kind, titlePl: t.titlePl, titleEn: t.titleEn, bodyPl: t.bodyPl, bodyEn: t.bodyEn };

describe("sendNotification template key", () => {
  beforeEach(() => vi.clearAllMocks());

  it("stores the key and params next to the pl/en fallback text", async () => {
    const { db, create } = fakeDb();
    await sendNotification({ ...base, templateKey: "welcome", params: { a: "b" } }, db);
    expect(create.mock.calls[0][0].data).toMatchObject({ templateKey: "welcome", params: { a: "b" }, titlePl: t.titlePl, titleEn: t.titleEn });
  });

  it("defaults params to an empty object and writes no key when none is given", async () => {
    const a = fakeDb();
    await sendNotification({ ...base, templateKey: "welcome" }, a.db);
    expect(a.create.mock.calls[0][0].data.params).toEqual({});
    const b = fakeDb();
    await sendNotification(base, b.db);
    expect(b.create.mock.calls[0][0].data).not.toHaveProperty("templateKey");
  });

  it("drops the key when an admin override replaces the text", async () => {
    const { db, create } = fakeDb({ titlePl: "A", titleEn: "B", bodyPl: "C", bodyEn: "D" });
    await sendNotification({ ...base, templateKey: "welcome" }, db);
    const data = create.mock.calls[0][0].data;
    expect(data).toMatchObject({ titlePl: "A", titleEn: "B" });
    expect(data).not.toHaveProperty("templateKey");
    expect(data).not.toHaveProperty("params");
  });

  it("keeps the key when skipTemplate ignores the override", async () => {
    const { db, create } = fakeDb({ titlePl: "A", titleEn: "B", bodyPl: "C", bodyEn: "D" });
    await sendNotification({ ...base, templateKey: "welcome", skipTemplate: true }, db);
    expect(create.mock.calls[0][0].data).toMatchObject({ templateKey: "welcome", titlePl: t.titlePl });
  });
});
