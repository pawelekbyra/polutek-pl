import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { isConfiguredAdminUserId } from '../../admin-config';
import { MAIN_CREATOR_NAME, ADMIN_EMAIL } from '../../constants';
export class UserAdminService {
  /**
   * Helper for seeder and local development only.
   * NOT FOR PRODUCTION USE.
   */
  static async ensureAdminUser() {
    if (process.env.NODE_ENV === "production") {
      throw new Error("ensureAdminUser must not be used in production");
    }

    return await prisma.user.upsert({
        where: { email: ADMIN_EMAIL },
        update: { role: 'ADMIN', name: MAIN_CREATOR_NAME },
        create: {
            id: `admin_dev_${crypto.randomBytes(4).toString('hex')}`,
            email: ADMIN_EMAIL,
            name: MAIN_CREATOR_NAME,
            role: 'ADMIN',
            language: "pl",
        }
    });
  }

  static isConfiguredAdmin(userId: string) {
    return isConfiguredAdminUserId(userId);
  }
}
