import React from 'react';
import Footer from '../components/Footer';
import { ContentService } from '@/lib/services/content.service';
import { prisma } from '@/lib/prisma';
import { auth, currentUser } from '@clerk/nextjs/server';
import { UserService } from '@/lib/services/user.service';
import CampaignContent from './CampaignContent';
import Navbar from '../components/Navbar';

export const dynamic = 'force-dynamic';

export default async function ZrzutkaPage() {
  const { userId } = auth();

  let userDb = null;
  if (userId) {
    userDb = await UserService.getOrCreateUser(userId).catch(() => null);
  }

  const adminData = await ContentService.getAdminData();
  const creator = await ContentService.getCreatorBySlug('polutek');

  const transactions = await prisma.transaction.findMany({
    where: {
      creatorId: creator?.id,
      status: 'COMPLETED'
    },
    select: {
      amount: true,
      currency: true
    }
  }).catch(() => []);

  const totalRaised = transactions.reduce((sum, tx) => sum + tx.amount, 0);
  const supportersCount = transactions.length;

  const user = await currentUser();
  const userProfile = userId ? {
    id: userId,
    email: user?.primaryEmailAddress?.emailAddress || '',
    name: userDb?.name || (user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : null),
    imageUrl: user?.imageUrl || null,
    totalPaid: userDb?.totalPaid || 0,
    role: userDb?.role || 'USER',
    referralCount: userDb?.referralCount || 0
  } : null;

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans">
      <Navbar />
      <main className="relative">
        <CampaignContent
          adminData={adminData}
          creator={creator}
          userProfile={userProfile as any}
          totalRaised={totalRaised}
          supportersCount={supportersCount}
        />
      </main>
      <Footer />
    </div>
  );
}
