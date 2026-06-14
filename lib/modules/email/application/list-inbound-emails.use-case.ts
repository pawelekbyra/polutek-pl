import { AppContext } from "../../shared/app-context";
import { UseCaseResult, ok, fail } from "../../shared/result";
import { EmailError } from "../domain/email.errors";
import { InboundEmailDto } from "../domain/email.dto";

/**
 * listInboundEmails use case.
 * R9: encapsulated fetching of inbound emails for admin view.
 */
export async function listInboundEmails(
  ctx: AppContext
): Promise<UseCaseResult<InboundEmailDto[], EmailError>> {
  try {
    const responses = await ctx.prisma.inboundEmail.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    return ok(responses as InboundEmailDto[]);
  } catch (error:
any) {
    return fail(new EmailError(error.message || "Failed to list inbound emails"));
  }
}
