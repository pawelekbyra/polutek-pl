import { PrismaClient } from '@prisma/client';
import { runLaunchContentDiagnostics } from '@/lib/launch/content-diagnostics';

const prisma = new PrismaClient();

function maskDatabaseUrl(value: string | undefined) {
  return value ? value.replace(/:[^:@/]+@/, ':****@') : '(missing)';
}

async function main() {
  console.log('=== LAUNCH OPERATOR DIAGNOSTICS ===');
  console.log(`Database: ${maskDatabaseUrl(process.env.DATABASE_URL)}`);
  console.log('Scope: production env + configured main creator + anonymous public content inventory.');
  console.log('Safety: this command does not change data and does not hide runtime configuration failures.\n');

  const result = await runLaunchContentDiagnostics({ db: prisma });

  for (const check of result.checks) {
    const marker = check.status === 'PASS' ? 'PASS' : check.status === 'WARN' ? 'WARN' : 'FAIL';
    console.log(`[${marker}] ${check.name}: ${check.detail}`);
    if (check.action) console.log(`       Action: ${check.action}`);
  }

  console.log('\nSummary:');
  console.log(JSON.stringify(result.summary, null, 2));

  if (!result.ok) {
    console.error('\nLAUNCH DIAGNOSTICS FAIL — launch remains NO_GO. Repair the failed checks and rerun with production env/DB before posting evidence for #956/#951.');
    process.exitCode = 1;
    return;
  }

  console.log('\nLAUNCH DIAGNOSTICS PASS — attach this output as operator evidence for #956/#951, then run the production route/playback smoke. This command alone does not certify public launch.');
}

main()
  .catch((error) => {
    console.error('[LAUNCH_DIAGNOSE_FATAL]', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
