import { clerkClient } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { AccountDeletionCleanupUseCase } from '@/lib/modules/users/application/account-deletion-cleanup.use-case';

async function clerkUserExists(userId: string) {
  try {
    const client = await clerkClient();
    await client.users.getUser(userId);
    return true;
  } catch (error: any) {
    const status = error?.status || error?.statusCode;
    if (status === 404) return false;
    throw error;
  }
}

async function main() {
  const users = await prisma.user.findMany({
    where: { isDeleted: false },
    select: { id: true },
  });

  const ctx = createAppContext({
    actor: { type: 'system', reason: 'Clerk missing-user reconciliation' },
    prisma,
  });

  const counts = { checked: 0, cleaned: 0, skipped: 0, failed: 0 };
  for (const user of users) {
    counts.checked += 1;
    try {
      if (await clerkUserExists(user.id)) {
        counts.skipped += 1;
        continue;
      }
      await AccountDeletionCleanupUseCase.execute(ctx, {
        userId: user.id,
        source: 'CLERK_RECONCILIATION',
        reason: 'Local user missing in Clerk reconciliation',
      });
      counts.cleaned += 1;
    } catch (error) {
      counts.failed += 1;
      console.error('[reconcile-missing-clerk-users] failed', user.id, error);
    }
  }

  console.log(JSON.stringify(counts, null, 2));
  if (counts.failed > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error('[reconcile-missing-clerk-users] fatal', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
