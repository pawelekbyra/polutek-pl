import { currentUser } from "@clerk/nextjs/server";
import Navbar from "@/app/components/Navbar";
import { ChannelSettingsForm } from "./ChannelSettingsForm";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { getActorFromAuth } from "@/lib/api/auth";
import { getAdminChannelSettings } from "@/lib/modules/channel";

export const dynamic = "force-dynamic";

export default async function AdminChannelPage() {
  const clerkUser = await currentUser();

  try {
    const actor = await getActorFromAuth();
    const ctx = createAppContext({ actor });
    const creator = await getAdminChannelSettings(ctx) as
any;

    return (
      <div className="min-h-screen bg-gradient-to-b from-muted/40 via-background to-background text-foreground">
        <Navbar />
        <ChannelSettingsForm initialCreator={creator} clerkFallbackImageUrl={clerkUser?.imageUrl || null} />
      </div>
    );
  } catch (err:
any) {
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
