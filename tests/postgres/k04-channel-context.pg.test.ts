import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { MainChannelService } from "@/lib/modules/channel/application/main-channel.service";
import { createAppContext } from "@/lib/modules/shared/app-context";

const prisma = new PrismaClient();
const run = `k04-context-${Date.now().toString(36)}`;
const userIds = [`${run}-visible-user`, `${run}-hidden-user`, `${run}-deleted-user`];
const creatorIds = [`${run}-visible`, `${run}-hidden`, `${run}-deleted`];

beforeAll(async () => {
  await Promise.all(userIds.map((id, index) => prisma.user.create({
    data: { id, email: `${id}@example.test`, name: `K04 ${index}` },
  })));
  await Promise.all(creatorIds.map((id, index) => prisma.creator.create({
    data: {
      id,
      userId: userIds[index],
      slug: id,
      name: `K04 ${index}`,
      status: index === 1 ? "SUSPENDED" : "ACTIVE",
      ...(index === 2 ? { deletedAt: new Date() } : {}),
    },
  })));
});

afterAll(async () => {
  await prisma.creator.deleteMany({ where: { id: { in: creatorIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

function context() {
  return createAppContext({ actor: { type: "guest" }, prisma });
}

describe("K04 injected Prisma composition against PostgreSQL", () => {
  it("uses the injected client through MainChannelService and ChannelRepository", async () => {
    const channel = await prisma.creator.findUniqueOrThrow({ where: { id: creatorIds[0] } });
    await expect(MainChannelService.getPubliclyVisibleById(context(), channel.id)).resolves.toEqual(channel);
  });

  it.each([creatorIds[1], creatorIds[2], `${run}-missing`])(
    "returns the same not-found response for hidden or missing channel %s",
    async (channelId) => {
      await expect(MainChannelService.getPubliclyVisibleById(context(), channelId)).rejects.toMatchObject({
        statusCode: 404,
        code: "CHANNEL_NOT_FOUND",
      });
    },
  );
});
