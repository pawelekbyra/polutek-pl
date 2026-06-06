import { currentUser } from "@clerk/nextjs/server";
import Navbar from "@/app/components/Navbar";
import { prisma } from "@/lib/prisma";
import { MainCreatorService } from "@/lib/services/main-creator.service";
import { ChannelSettingsForm } from "./ChannelSettingsForm";

export const dynamic = "force-dynamic";

export default async function AdminChannelPage() {
  const clerkUser = await currentUser();
  const data = clerkUser?.id
    ? await prisma.$transaction(async (tx) => {
        const mainCreator = await MainCreatorService.getOrCreateForAdmin(clerkUser.id, tx, {
          repairSingleChannelContent: true,
        });

        const creator = await tx.creator.findUnique({
          where: { id: mainCreator.id },
          select: {
            id: true,
            slug: true,
            name: true,
            bio: true,
            bannerUrl: true,
            subscribersCount: true,
            fakeSubscribersCount: true,
            user: { select: { name: true, imageUrl: true } },
          },
        });

        const currencySettings = await tx.currencySetting.findMany();
        return { creator, currencySettings };
      })
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/40 via-background to-background text-foreground">
      <Navbar />
      <ChannelSettingsForm
        initialCreator={data?.creator || null}
        initialCurrencySettings={data?.currencySettings || []}
        clerkFallbackImageUrl={clerkUser?.imageUrl || null}
      />
    </div>
  );
}
