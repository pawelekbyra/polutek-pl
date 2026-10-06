/**
 * SES bounce/complaint events on a real Postgres: suppression, consent withdrawal, broadcast recipient status,
 * idempotency by SNS MessageId and out-of-order safety.
 *
 *   DATABASE_URL=postgresql://... npx vitest run --config vitest.postgres.config.ts
 */
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { handleSesEvent } from '@/lib/modules/email/application/handle-ses-event.use-case';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { sesEvent } from '../helpers/sns';

const prisma = new PrismaClient();
const RUN = `pg-ses-${Date.now().toString(36)}`;
const ctx = () => createAppContext({ actor: { type: 'system', reason: 'pg-test' }, prisma });
const addr = (n: string) => `${RUN}-${n}@example.test`;
const ids = { userBounce: `${RUN}-ub`, userComplaint: `${RUN}-uc`, broadcast: '' };

const send = (type: string, extra: Record<string, unknown>, snsId: string, sesId: string) =>
  handleSesEvent(ctx(), { snsMessageId: `${RUN}-${snsId}`, payload: JSON.parse(sesEvent(type, extra, sesId)) });
const bounce = (email: string, kind = 'Permanent') => ({ bounce: { bounceType: kind, bouncedRecipients: [{ emailAddress: email }] } });
const complaint = (email: string) => ({ complaint: { complainedRecipients: [{ emailAddress: email }] } });

beforeAll(async () => {
  await prisma.user.create({ data: { id: ids.userBounce, email: addr('bounce'), name: `${RUN} b` } });
  await prisma.user.create({ data: { id: ids.userComplaint, email: addr('complaint'), name: `${RUN} c` } });
  await prisma.emailPreference.create({ data: { userId: ids.userComplaint, email: addr('complaint'), marketingEmails: true } });
  const broadcast = await prisma.broadcastEmail.create({ data: { subjectPl: 's', htmlPl: 'h', subjectEn: 's', htmlEn: 'h' } });
  ids.broadcast = broadcast.id;
  for (const [n, userId] of [['bounce', ids.userBounce], ['complaint', ids.userComplaint]] as const) {
    await prisma.broadcastEmailRecipient.create({ data: { broadcastEmailId: broadcast.id, userId, email: addr(n), status: 'SENT', resendEmailId: `${RUN}-ses-${n}` } });
  }
});

afterAll(async () => {
  await prisma.emailEvent.deleteMany({ where: { providerEventId: { startsWith: RUN } } });
  await prisma.emailSuppression.deleteMany({ where: { email: { startsWith: RUN } } });
  await prisma.broadcastEmail.deleteMany({ where: { id: ids.broadcast } });
  await prisma.emailPreference.deleteMany({ where: { email: { startsWith: RUN } } });
  await prisma.user.deleteMany({ where: { id: { in: [ids.userBounce, ids.userComplaint] } } });
  await prisma.$disconnect();
});

describe('SES events with a real database', () => {
  it('a permanent bounce suppresses the address, marks the recipient BOUNCED and is idempotent per SNS MessageId', async () => {
    const first = await send('Bounce', bounce(addr('bounce')), 'b1', `${RUN}-ses-bounce`);
    expect(first).toMatchObject({ ok: true, data: { duplicate: false } });
    const row = await prisma.emailSuppression.findUnique({ where: { email: addr('bounce') } });
    expect(row).toMatchObject({ reason: 'BOUNCE', active: true, source: 'SES_SNS', providerEmailId: `${RUN}-ses-bounce` });
    expect((await prisma.broadcastEmailRecipient.findFirst({ where: { resendEmailId: `${RUN}-ses-bounce` } }))?.status).toBe('BOUNCED');

    // Replay: same MessageId -> duplicate, one event row.
    expect(await send('Bounce', bounce(addr('bounce')), 'b1', `${RUN}-ses-bounce`)).toMatchObject({ ok: true, data: { duplicate: true } });
    expect(await prisma.emailEvent.count({ where: { providerEventId: `${RUN}-b1` } })).toBe(1);
    expect((await prisma.emailEvent.findUnique({ where: { providerEventId: `${RUN}-b1` } }))).toMatchObject({ type: 'email.bounced', status: 'PROCESSED' });
  });

  it('a late Delivery after the bounce does not undo it', async () => {
    await send('Delivery', { delivery: { recipients: [addr('bounce')] } }, 'd1', `${RUN}-ses-bounce`);
    expect((await prisma.broadcastEmailRecipient.findFirst({ where: { resendEmailId: `${RUN}-ses-bounce` } }))?.status).toBe('BOUNCED');
  });

  it('a transient bounce records the event and blocks nobody', async () => {
    await send('Bounce', bounce(addr('transient'), 'Transient'), 't1', `${RUN}-ses-none`);
    expect(await prisma.emailSuppression.findUnique({ where: { email: addr('transient') } })).toBeNull();
    expect(await prisma.emailEvent.count({ where: { providerEventId: `${RUN}-t1`, type: 'email.bounced_transient' } })).toBe(1);
  });

  it('a complaint suppresses and withdraws the content-notification consent', async () => {
    const res = await send('Complaint', complaint(addr('complaint')), 'c1', `${RUN}-ses-complaint`);
    expect(res.ok).toBe(true);
    expect(await prisma.emailSuppression.findUnique({ where: { email: addr('complaint') } })).toMatchObject({ reason: 'COMPLAINT', active: true });
    expect(await prisma.emailPreference.findUnique({ where: { email: addr('complaint') } })).toMatchObject({ marketingEmails: false });
    expect((await prisma.emailPreference.findUnique({ where: { email: addr('complaint') } }))?.unsubscribedAt).not.toBeNull();
    expect((await prisma.broadcastEmailRecipient.findFirst({ where: { resendEmailId: `${RUN}-ses-complaint` } }))?.status).toBe('COMPLAINED');
  });
});
