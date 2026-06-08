import { currentUser } from "@clerk/nextjs/server";
import Navbar from "@/app/components/Navbar";
import { prisma } from "@/lib/prisma";
import { MainCreatorService } from "@/lib/services/main-creator.service";
import { ChannelSettingsForm } from "./ChannelSettingsForm";
import { MainChannelService } from "@/lib/channel/main-channel.service";

export const dynamic = "force-dynamic";

export default async function AdminChannelPage() {
  const clerkUser = await currentUser();

  try {
    const creator = await prisma.$transaction(async (tx) => {
        const mainCreator = await MainChannelService.getRequired(tx as any);

        return tx.creator.findUnique({
          where: { id: mainCreator.id },
          select: {
            id: true,
            slug: true,
            name: true,
            bio: true,
            bannerUrl: true,
            subscribersCount: true,
            displaySubscribersCount: true,
            user: { select: { name: true, imageUrl: true } },
          },
        });
    });

    return (
      <div className="min-h-screen bg-gradient-to-b from-muted/40 via-background to-background text-foreground">
        <Navbar />
        <ChannelSettingsForm initialCreator={creator} clerkFallbackImageUrl={clerkUser?.imageUrl || null} />
      </div>
    );
  } catch (err: any) {
    return (
        <div className="min-h-screen bg-muted/40 flex flex-col">
            <Navbar />
            <div className="flex-1 flex items-center justify-center p-6">
                <div className="max-w-md w-full bg-background border border-destructive/20 p-8 rounded-xl shadow-sm text-center">
                    <h1 className="text-2xl font-bold text-destructive mb-4">Maintenance Required</h1>
                    <p className="text-muted-foreground mb-6">
                        {err.message || "Main channel configuration is missing or invalid."}
                    </p>
                    <div className="bg-muted p-4 rounded text-xs text-left overflow-auto mb-6">
                        <code>Error: {err.name}</code>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Please run the maintenance setup to initialize the main channel.
                    </p>
                </div>
            </div>
        </div>
    );
  }
}
