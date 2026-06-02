import { prisma } from "../lib/prisma";
import { UserAccessService } from "../lib/services/user-access.service";

async function main() {
  console.log("=== CLERK ACCESS RESYNC ===");

  try {
    const users = await prisma.user.findMany();

    console.log(`Found ${users.length} users to resync.`);

    for (const user of users) {
      console.log(`Resyncing user ${user.id} (${user.email})...`);
      await UserAccessService.syncClerkAccess(user.id, user.isPatron, 0);
    }

    console.log("=== RESYNC COMPLETE ===");
  } catch (error) {
    console.error("CRITICAL RESYNC ERROR:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
