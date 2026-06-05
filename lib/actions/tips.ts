'use server';

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function getUserTips() {
  const { userId } = await auth();
  if (!userId) return [];

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true }
  });

  if (!user) return [];

  const payments = await prisma.payment.findMany({
    where: {
      userId,
      status: {
        in: ['SUCCEEDED', 'PARTIALLY_REFUNDED', 'REFUNDED']
      }
    },
    include: {
      creator: {
        select: {
          id: true,
          name: true,
          slug: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  return payments.map(p => ({
    id: p.id,
    createdAt: p.createdAt,
    amountMinor: p.amountMinor,
    currency: p.currency,
    status: p.status,
    refundedAmountMinor: p.refundedAmountMinor || 0,
    netAmountMinor: Math.max(0, p.amountMinor - (p.refundedAmountMinor || 0)),
    creator: p.creator
  }));
}
