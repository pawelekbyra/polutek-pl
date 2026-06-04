import { prisma } from '@/lib/prisma';
import { grantPatronStatus } from '@/lib/services/patron.service';

async function main() {
  const subscriptions = await prisma.subscription.findMany({
    select: { userId: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  const firstSubscriptionByUser = new Map<string, Date>();
  for (const subscription of subscriptions) {
    if (!firstSubscriptionByUser.has(subscription.userId)) {
      firstSubscriptionByUser.set(subscription.userId, subscription.createdAt);
    }
  }

  let migrated = 0;
  for (const [userId, createdAt] of firstSubscriptionByUser) {
    const result = await grantPatronStatus(userId, {
      source: 'migration',
      note: 'Migrated from legacy Subscription access model',
    });

    await prisma.user.update({
      where: { id: userId },
      data: { patronSince: result.user.patronSince || createdAt },
    });

    migrated += 1;
  }

  console.log(`Migrated ${migrated} users with legacy subscriptions to User.isPatron.`);
}

main()
  .catch((error) => {
    console.error('[MIGRATE_PATRONS_ERROR]', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
