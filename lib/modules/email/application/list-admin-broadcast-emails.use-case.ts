import { AppContext } from "../../shared/app-context";
import { AdminBroadcastEmailListItemDto } from "../domain/email.dto";
import { UseCaseResult, ok, fail } from "../../shared/result";
import { EmailError } from "../domain/email.errors";
import { EmailRepository } from "../infrastructure/email.repository";

/**
 * listAdminBroadcastEmails use case.
 * Fetches the history of admin broadcast emails.
 */
export async function listAdminBroadcastEmails(
  ctx: AppContext
): Promise<UseCaseResult<AdminBroadcastEmailListItemDto[], EmailError>> {
  try {
    const repository = new EmailRepository(ctx.prisma);
    const history = await repository.listBroadcastHistory();

    return ok(history);
  } catch (error: any) {
    return fail(new EmailError(error.message || "Failed to fetch broadcast history"));
  }
}
