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
}
