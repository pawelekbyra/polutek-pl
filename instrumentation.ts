export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { prisma } = await import('./lib/prisma');
    const { ensureRequiredEmailTemplates } = await import('./scripts/ensure-required-emails');
    await ensureRequiredEmailTemplates(prisma.emailTemplate).catch((err) => {
      console.error('[instrumentation] Failed to seed email templates:', err);
    });
  }
}
