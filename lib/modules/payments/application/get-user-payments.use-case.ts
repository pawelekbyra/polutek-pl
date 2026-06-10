import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok } from "@/lib/modules/shared/result";
import { PaymentRepository } from "../infrastructure/payment.repository";
import { PaymentDto } from "../domain/payment.dto";

export async function getUserPayments(
  userId: string,
  limit: number,
  ctx: AppContext
): Promise<UseCaseResult<PaymentDto[]>> {
  const repo = new PaymentRepository();
  const payments = await repo.findManyByUserId(userId, limit, ctx.db.read);
  return ok(payments);
}
