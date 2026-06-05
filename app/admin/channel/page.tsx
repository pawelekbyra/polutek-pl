import { currentUser } from "@clerk/nextjs/server";
import Navbar from "@/app/components/Navbar";
import { prisma } from "@/lib/prisma";
import { flags } from "@/lib/feature-flags";
import { ChannelSettingsForm } from "./ChannelSettingsForm";

export const dynamic = "force-dynamic";

export default async function AdminChannelPage() {
  const [creator, clerkUser] = await Promise.all([
    prisma.creator.findUnique({
      where: { slug: flags.mainCreatorSlug },
      select: {
        id: true,
        slug: true,
        name: true,
        bio: true,
        bannerUrl: true,
        user: { select: { name: true, imageUrl: true } },
      },
    }),
    currentUser(),
  ]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/40 via-background to-background text-foreground">
      <Navbar />
      <ChannelSettingsForm initialCreator={creator} clerkFallbackImageUrl={clerkUser?.imageUrl || null} />
    </div>
  );
}
