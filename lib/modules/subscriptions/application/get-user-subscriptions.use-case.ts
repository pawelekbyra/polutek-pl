import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok } from "@/lib/modules/shared/result";
import { SubscriptionRepository } from "../infrastructure/subscription.repository";

export async function getUserSubscriptions(
  userId: string,
  ctx: AppContext
): Promise<UseCaseResult<any[]>> {
  const repo = new SubscriptionRepository(ctx.db.read);
  const subscriptions = await repo.findManyByUserId(userId);
  return ok(subscriptions);
}
