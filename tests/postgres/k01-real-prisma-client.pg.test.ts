/** K01 verifies the generated Prisma client against PostgreSQL constraints and transaction rollback. */
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";

const prisma = new PrismaClient();
const RUN = `k01-prisma-${randomUUID()}`;
const createdUserIds: string[] = [];

afterAll(async () => {
  if (createdUserIds.length) await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

describe("K01 generated Prisma client (PostgreSQL)", () => {
  it("writes and reads a row, rolls back a transaction, and enforces FK/unique constraints", async () => {
    const user = await prisma.user.create({
      data: { id: `${RUN}-user`, email: `${RUN}@example.test`, name: "K01 Prisma smoke" },
    });
    createdUserIds.push(user.id);
    await expect(prisma.user.findUnique({ where: { id: user.id } })).resolves.toMatchObject({
      id: user.id,
      email: `${RUN}@example.test`,
    });

    const rolledBackUserId = `${RUN}-rolled-back`;
    await expect(prisma.$transaction(async (tx) => {
      await tx.user.create({
        data: { id: rolledBackUserId, email: `${RUN}-rolled-back@example.test`, name: "Rollback probe" },
      });
      throw new Error("K01 transaction rollback probe");
    })).rejects.toThrow("K01 transaction rollback probe");
    await expect(prisma.user.findUnique({ where: { id: rolledBackUserId } })).resolves.toBeNull();

    await expect(prisma.user.create({
      data: { id: `${RUN}-duplicate`, email: user.email, name: "Duplicate unique value" },
    })).rejects.toMatchObject({ code: "P2002" });

    await expect(prisma.creator.create({
      data: {
        userId: `${RUN}-missing-user`,
        slug: `${RUN}-invalid-fk`,
        name: "Invalid foreign key",
        status: "ACTIVE",
      },
    })).rejects.toMatchObject({ code: "P2003" });
  });
});
