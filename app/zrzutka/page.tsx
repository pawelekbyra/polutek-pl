import React from 'react';
import Footer from '../components/Footer';
import { ContentService } from '@/lib/services/content.service';
import { prisma } from '@/lib/prisma';
import { normalizePaymentTotals } from '@/lib/services/user-access.service';
import { auth, currentUser } from '@clerk/nextjs/server';
import { UserService } from '@/lib/services/user.service';
import CampaignContent from './CampaignContent';
import Navbar from '../components/Navbar';
import { flags } from '@/lib/feature-flags';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function ZrzutkaPage() {
  if (!flags.campaignPage) {
    notFound();
  }

  const { userId } = await auth();

  let userDb = null;
  if (userId) {
    userDb = await prisma.user.findUnique({
      where: { id: userId },
      include: { paymentTotals: true }
    }).catch(() => null);

    if (!userDb) {
      await UserService.getOrCreateUser(userId).catch(() => null);
      userDb = await prisma.user.findUnique({
        where: { id: userId },
        include: { paymentTotals: true }
      }).catch(() => null);
    }
  }

  const adminData = await ContentService.getAdminData();
  const creator = await ContentService.getCreatorBySlug('polutek');

  const payments = await prisma.payment.findMany({
    where: {
      creatorId: creator?.id,
      status: 'SUCCEEDED'
    },
    select: {
      amountMinor: true,
      currency: true
    }
  }).catch(() => []);

  const totalRaised = payments.reduce((sum, p) => sum + (p.amountMinor / 100), 0);
  const supportersCount = payments.length;

  const user = await currentUser();
  const userProfile = userId ? {
    id: userId,
    email: user?.primaryEmailAddress?.emailAddress || '',
    name: userDb?.name || (user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : null),
    imageUrl: user?.imageUrl || null,
    totalPaid: (userDb && 'paymentTotals' in userDb) ? normalizePaymentTotals(userDb.paymentTotals) : 0,
    isPatron: userDb?.isPatron || false,
    role: userDb?.role || 'USER',
    referralPoints: userDb?.referralPoints || 0
  } : null;

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans">
      <Navbar />
      <main className="relative">
        <CampaignContent
          adminData={adminData}
          creator={creator}
          userProfile={userProfile}
          totalRaised={totalRaised}
          supportersCount={supportersCount}
        />
      </main>
      <Footer />
    </div>
  );
}
