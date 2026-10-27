import { describe, it, expect, vi } from 'vitest';
import { SubscriptionRepository } from '@/lib/modules/subscriptions/infrastructure/subscription.repository';
import { ChannelRepository } from '@/lib/modules/channel/infrastructure/channel.repository';

const row = { id: 's1', createdAt: new Date('2026-10-14T00:00:00Z'), notify: true };

function fakeTx(insertedCount: number) {
  const calls: string[] = [];
  const tx = {
    subscription: {
      createMany: vi.fn(async () => {
        calls.push('createMany');
        return { count: insertedCount };
      }),
      findUnique: vi.fn(async () => {
        calls.push('findUnique');
        return row;
      }),
      count: vi.fn(async () => {
        calls.push('count');
        return 2;
      }),
    },
    creator: {
      update: vi.fn(async () => {
        calls.push('update');
        return { id: 'c1', subscribersCount: 2 };
      }),
    },
    $queryRaw: vi.fn(async () => {
      calls.push('lock');
      return [];
    }),
    $executeRaw: vi.fn(async () => {
      calls.push('userLock');
      return 1;
    }),
  };
  return { tx, calls };
}

describe('SubscriptionRepository.createIfMissing (DB-08)', () => {
  it('inserts with ON CONFLICT DO NOTHING and reports created', async () => {
    const { tx } = fakeTx(1);
    const repo = new SubscriptionRepository({} as any);

    const result = await repo.createIfMissing('u1', 'c1', tx as any);

    expect(tx.subscription.createMany).toHaveBeenCalledWith({
      data: [{ userId: 'u1', creatorId: 'c1' }],
      skipDuplicates: true,
    });
    expect(result).toEqual({ subscription: row, created: true });
  });

  it('is idempotent for an existing subscription: no error, created=false, row read after the insert', async () => {
    const { tx, calls } = fakeTx(0);
    const repo = new SubscriptionRepository({} as any);

    const result = await repo.createIfMissing('u1', 'c1', tx as any);

    expect(result).toEqual({ subscription: row, created: false });
    expect(calls).toEqual(['createMany', 'findUnique']);
  });

  it('takes a per-user advisory lock', async () => {
    const { tx, calls } = fakeTx(1);
    await new SubscriptionRepository({} as any).lockUser('u1', tx as any);
    expect(calls).toEqual(['userLock']);
  });
});

describe('ChannelRepository.syncSubscribersCount (DB-09)', () => {
  it('locks the channel row before it recounts, then writes the count', async () => {
    const { tx, calls } = fakeTx(0);
    const repo = new ChannelRepository({} as any);

    await repo.syncSubscribersCount('c1', tx as any);

    expect(calls).toEqual(['lock', 'count', 'update']);
    expect(tx.creator.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { subscribersCount: 2 } });
  });
});
