import { currentUser } from "@clerk/nextjs/server";
import Navbar from "@/app/components/Navbar";
import { prisma } from "@/lib/prisma";
import { MainCreatorService } from "@/lib/services/main-creator.service";
import { ChannelSettingsForm } from "./ChannelSettingsForm";

export const dynamic = "force-dynamic";

export default async function AdminChannelPage() {
  const clerkUser = await currentUser();
  const creator = clerkUser?.id
    ? await prisma.$transaction(async (tx) => {
        const mainCreator = await MainCreatorService.getOrCreateForAdmin(clerkUser.id, tx, {
          repairSingleChannelContent: true,
        });

        return tx.creator.findUnique({
          where: { id: mainCreator.id },
          select: {
            id: true,
            slug: true,
            name: true,
            bio: true,
            bannerUrl: true,
            user: { select: { name: true, imageUrl: true } },
          },
        });
      })
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/40 via-background to-background text-foreground">
      <Navbar />
      <ChannelSettingsForm initialCreator={creator} clerkFallbackImageUrl={clerkUser?.imageUrl || null} />
    </div>
  );
}
