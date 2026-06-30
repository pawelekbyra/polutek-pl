import { prisma } from "../lib/prisma";
import { syncClerkAccess } from "../lib/modules/users/application/sync-clerk-access";
import { DISPLAY_EUR_TO_PLN_RATE } from "../lib/constants";

async function main() {
  console.log("=== CLERK ACCESS RESYNC ===");

  try {
    const users = await prisma.user.findMany({
      include: {
        paymentTotals: true,
        patronGrants: { where: { revokedAt: null }, select: { id: true } },
      }
    });

    console.log(`Found ${users.length} users to resync.`);

    for (const user of users) {
      const totalPLN = user.paymentTotals.find(t => t.currency === 'PLN')?.amountMinor || 0;
      const totalEUR = user.paymentTotals.find(t => t.currency === 'EUR')?.amountMinor || 0;
      const normalizedTotal = (totalPLN / 100) + (totalEUR / 100 * DISPLAY_EUR_TO_PLN_RATE);
      const isPatron = user.patronGrants.length > 0;

      console.log(`Resyncing user ${user.id} (${user.email})...`);
      await syncClerkAccess(user.id, isPatron, normalizedTotal);
    }

    console.log("=== RESYNC COMPLETE ===");
  } catch (error) {
    console.error("CRITICAL RESYNC ERROR:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
