import { AppContext, createAppContext as baseCreateAppContext } from "@/lib/modules/shared/app-context";
import { auth } from "@clerk/nextjs/server";
import { isConfiguredAdminUserId } from "@/lib/admin-config";
import { prisma } from "@/lib/prisma";

export async function createAppContextFromRequest(requestId?: string): Promise<AppContext> {
  const { userId } = await auth();

  if (!userId) {
    return baseCreateAppContext({
        actor: { type: 'guest' }
    });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, isPatron: true }
  });

  if (user?.role === 'ADMIN' || isConfiguredAdminUserId(userId)) {
    return baseCreateAppContext({
        actor: { type: 'admin', userId },
        requestId
    });
  }

  return baseCreateAppContext({
    actor: { type: 'user', userId, isPatron: user?.isPatron ?? false },
    requestId
  });
}
