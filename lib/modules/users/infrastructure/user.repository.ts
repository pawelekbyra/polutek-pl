import { ReadDb } from "@/lib/modules/shared/db";
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

  async updateLanguage(id: string, language: string) {
    return await (this.db as any).user.update({
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
    referralCode?: string;
  }) {
    return await (this.db as any).user.upsert({
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
        referralCode: data.referralCode,
      },
    });
  }
}
