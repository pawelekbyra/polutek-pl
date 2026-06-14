import {
  AppContext,
  createAppContext as baseCreateAppContext,
} from "@/lib/modules/shared/app-context";
import { getActorFromAuth } from "@/lib/api/auth";
import { AppError } from "@/lib/errors";

type AppContextFromRequestOptions = {
  allowGuest?: boolean;
  requireAdmin?: boolean;
};

export async function createAppContextFromRequest(
  requestId?: string,
  options: AppContextFromRequestOptions = { allowGuest: false },
): Promise<AppContext> {
  const actor = await getActorFromAuth({
    allowGuest: options.allowGuest === true,
  });

  if (options.requireAdmin !== false && actor.type !== "admin") {
    throw new AppError("Forbidden", 403, "FORBIDDEN");
  }

  return baseCreateAppContext({
    actor,
    requestId,
  });
}
