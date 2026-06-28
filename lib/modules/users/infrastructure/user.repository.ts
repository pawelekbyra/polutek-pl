import { ReadDb, WriteTx } from "@/lib/modules/shared/db";
import { PrismaClient } from "@prisma/client";

export class UserRepository {
  constructor(private db: ReadDb) {}

  private get user() {
    return (this.db as PrismaClient).user;
  }

  async findById(id: string) {
    return await this.user.findUnique({
      where: { id },
    });
  }

  async findByClerkId(clerkId: string) {
    return await this.findById(clerkId);
  }

  async findByEmail(email: string) {
    return await this.user.findUnique({
      where: { email },
    });
  }

  async findActiveById(id: string) {
    return await this.user.findUnique({
      where: { id, isDeleted: false },
    });
  }

  async findProfileById(id: string, tx?: WriteTx) {
    const db = tx || (this.db as any);
    return await db.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
        imageUrl: true,
        language: true,
        isDeleted: true,
        createdAt: true,
      }
    });
  }

  async updateLanguage(id: string, language: string) {
    return await this.user.update({
      where: { id },
      data: { language },
    });
  }

  async upsertUser(data: {
    id: string;
    email: string;
    name?: string | null;
    username?: string | null;
    imageUrl?: string | null;
    language?: string;
  }) {
    return await this.user.upsert({
      where: { id: data.id },
      update: {
        email: data.email,
        name: data.name,
        username: data.username,
        imageUrl: data.imageUrl,
        language: data.language,
      },
      create: {
        id: data.id,
        email: data.email,
        name: data.name,
        username: data.username,
        imageUrl: data.imageUrl,
        language: data.language || 'en',
      },
    });
  }

  async findWithPaymentTotalsAndActivePatronGrants(id: string) {
    return await this.user.findUnique({
      where: { id },
      include: {
        paymentTotals: true,
        patronGrants: {
          where: { revokedAt: null },
          select: { id: true },
          take: 1,
        },
      } as any
    });
  }

  async hasActivePatronGrant(userId: string): Promise<boolean> {
    const grant = await (this.db as PrismaClient).patronGrant.findFirst({
      where: { userId, revokedAt: null },
      select: { id: true },
    });

    return grant !== null;
  }

  async create(data: any) {
      return await this.user.create({ data });
  }

  async update(id: string, data: any) {
      return await this.user.update({
          where: { id },
          data
      });
  }

  async findPatronGrants(userId: string) {
    return await (this.db as PrismaClient).patronGrant.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
  }
}
