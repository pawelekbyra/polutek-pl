import { currentUser } from "@clerk/nextjs/server";
import Navbar from "@/app/components/Navbar";
import { ChannelSettingsForm } from "./ChannelSettingsForm";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { requireAdmin } from "@/lib/auth-utils";
import {
  classifyAdminChannelError,
  logAdminChannelError,
} from "@/lib/admin-channel-error-classification";
import { getAdminChannelSettings } from "@/lib/modules/channel";

export const dynamic = "force-dynamic";

export default async function AdminChannelPage() {
  const clerkUser = await currentUser();

  try {
    const adminUserId = await requireAdmin();
    const ctx = createAppContext({
      actor: { type: "admin", userId: adminUserId },
    });
    const creator = await getAdminChannelSettings(ctx);

    return (
      <div className="min-h-screen bg-gradient-to-b from-muted/40 via-background to-background text-foreground">
        <Navbar />
        <ChannelSettingsForm
          initialCreator={creator}
          clerkFallbackImageUrl={clerkUser?.imageUrl || null}
        />
      </div>
    );
  } catch (err: unknown) {
    logAdminChannelError(err, "ADMIN_CHANNEL_PAGE_LOAD_ERROR");
    const classified = classifyAdminChannelError(err);

    return (
      <div className="min-h-screen bg-muted/40 flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-background border border-destructive/20 p-8 rounded-xl shadow-sm text-center">
            <h1 className="text-2xl font-bold text-destructive mb-4">
              {classified.title}
            </h1>
            <p className="text-muted-foreground mb-6">{classified.message}</p>
            <div className="bg-muted p-4 rounded text-xs text-left overflow-auto mb-6">
              <code>Error: {classified.code}</code>
            </div>
            {classified.showMaintenanceNote ? (
              <p className="text-sm text-muted-foreground">
                Review the main-channel configuration before running maintenance
                manually.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    );
  }
}
