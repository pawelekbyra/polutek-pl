import { prisma } from "../lib/prisma";
import { UserAccessService } from "../lib/services/user-access.service";
import { DISPLAY_EUR_TO_PLN_RATE } from "../lib/constants";

async function main() {
  console.log("=== CLERK ACCESS RESYNC ===");

  try {
    const users = await prisma.user.findMany({
      include: {
        paymentTotals: true
      }
    });

    console.log(`Found ${users.length} users to resync.`);

    for (const user of users) {
      const totalPLN = user.paymentTotals.find(t => t.currency === 'PLN')?.amountMinor || 0;
      const totalEUR = user.paymentTotals.find(t => t.currency === 'EUR')?.amountMinor || 0;
      const normalizedTotal = (totalPLN / 100) + (totalEUR / 100 * DISPLAY_EUR_TO_PLN_RATE);

      console.log(`Resyncing user ${user.id} (${user.email})...`);
      await UserAccessService.syncClerkAccess(user.id, user.isPatron, normalizedTotal);
    }

    console.log("=== RESYNC COMPLETE ===");
  } catch (error) {
    console.error("CRITICAL RESYNC ERROR:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
