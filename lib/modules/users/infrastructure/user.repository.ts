import { DbClient } from "@/lib/modules/shared/db";
import { PrismaClient } from "@prisma/client";

export class UserRepository {
  constructor(private db: DbClient) {}

  async findById(id: string) {
    return await (this.db as PrismaClient).user.findUnique({
      where: { id, isDeleted: false },
    });
  }

  async findByEmail(email: string) {
    return await (this.db as PrismaClient).user.findUnique({
      where: { email, isDeleted: false },
    });
  }
}
