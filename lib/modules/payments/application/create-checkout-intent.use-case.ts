import Stripe from "stripe";
import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok as success, fail as failure } from "@/lib/modules/shared/result";
import { PaymentStatus, Prisma } from "@prisma/client";
import { CreateCheckoutIntentInput, CheckoutResultDto, PaymentDto } from "../domain/payment.dto";
import { PaymentPolicy } from "../domain/payment.policy";
import { isPremiumPassPayment, PAYMENT_PURPOSE_PREMIUM_PASS } from "../domain/payment.purpose";
import { InvalidPaymentRequestError, UserNotFoundError, PaymentProviderError, PaymentError } from "../domain/payment.errors";
import { PaymentRepository } from "../infrastructure/payment.repository";
import { MainChannelService } from "@/lib/modules/channel";
import { getStripeClient } from "../infrastructure/stripe-client";
import { logger } from "@/lib/logger";
import { APP_NAME } from "@/lib/constants";

/** Intent states whose amount and currency may still change (nothing confirmed yet). */
const UPDATABLE_INTENT_STATES: ReadonlySet<Stripe.PaymentIntent.Status> = new Set([
  "requires_payment_method",
  "requires_confirmation",
]);

/** Shown in the BLIK banking app, on statements and in the Dashboard; never taken from the client. */
export function tipIntentDescription(language: string | null | undefined): string {
  // Polish for a Polish (or unknown) account; every other interface language gets English.
  return !language || language === "pl" ? `Napiwek dla ${APP_NAME}` : `Tip for ${APP_NAME}`;
}

/** Shown in the BLIK app and on statements for a patron-zone payment (patron zone); never from the client. */
export function patronIntentDescription(language: string | null | undefined): string {
  return !language || language === "pl" ? `Dostęp do strefy patrona: ${APP_NAME}` : `Patron zone access: ${APP_NAME}`;
}

class PaymentInProgressError extends PaymentError {
  constructor() {
    super("This tip is already being paid. Finish or cancel it before changing the amount.", "PAYMENT_IN_PROGRESS", 409);
    this.name = "PaymentInProgressError";
  }
}

type CheckoutError = InvalidPaymentRequestError | UserNotFoundError | PaymentProviderError | PaymentError;

function terminal(payment: PaymentDto): CheckoutResultDto {
  return { paymentId: payment.id, clientSecret: null, status: payment.status, terminal: true };
}

function ready(paymentId: string, intent: Stripe.PaymentIntent): CheckoutResultDto {
  return { paymentId, clientSecret: intent.client_secret, paymentMethodTypes: intent.payment_method_types };
}

/**
 * Creates (or, for the same attempt, reuses and updates) the PaymentIntent for one tip.
 *
 * One attempt = one client `requestId` = one local Payment = one PaymentIntent. Going back and
 * changing the amount or currency updates that intent instead of opening a new one, so abandoned
 * screens don't leave a trail of open intents and PENDING rows. Whatever is left unpaid is canceled
 * by the reconciliation cron after 24 h.
 */
export async function createCheckoutIntent(
  input: CreateCheckoutIntentInput,
  ctx: AppContext
): Promise<UseCaseResult<CheckoutResultDto, CheckoutError>> {
  if (!PaymentPolicy.canCreateCheckout(ctx.actor)) {
    return failure(new InvalidPaymentRequestError("Actor not authorized to create checkout intent."));
  }

  const repo = new PaymentRepository();
  const stripe = getStripeClient();
  const currency = PaymentPolicy.getDbCurrency(input.currency);

  const user = await repo.findUser(input.userId, ctx.db.read);
  if (!user) return failure(new UserNotFoundError(input.userId));

  try {
    if (input.requestId) {
      const existing = await repo.findPaymentByRequestId(input.userId, input.requestId, ctx.db.read);
      if (existing) return await reuseAttempt(existing, input, user, ctx);
    }

    const mainChannel = await MainChannelService.getRequired(ctx);
    const creatorId = mainChannel.id;

    let stripeCustomerId = user.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({ email: user.email, metadata: { userId: user.id } });
      stripeCustomerId = customer.id;
      await repo.updateStripeCustomerId(user.id, stripeCustomerId, ctx.prisma);
    }

    let payment: PaymentDto;
    try {
      payment = await repo.createPayment({
        userId: user.id,
        creatorId,
        amountMinor: input.amountMinor,
        currency,
        status: PaymentStatus.PENDING,
        metadata: {
          ...(input.requestId ? { requestId: input.requestId } : {}),
          ...(input.purpose ? { purpose: input.purpose } : {}),
          ...(input.purpose && input.productId ? { productId: input.productId } : {}),
        },
        requestId: input.requestId ?? null,
      }, ctx.prisma);
    } catch (error) {
      // A concurrent request for the same attempt won the race: continue with its row.
      if (input.requestId && error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const existing = await repo.findPaymentByRequestId(input.userId, input.requestId, ctx.db.read);
        if (existing) return await reuseAttempt(existing, input, user, ctx);
      }
      throw error;
    }

    try {
      const intent = await createIntentFor(payment, { ...user, stripeCustomerId }, ctx);
      return success(ready(payment.id, intent));
    } catch (error) {
      logger.error(`[createCheckoutIntent] Error creating Stripe intent for payment ${payment.id}`, error);
      await repo.updatePayment(payment.id, { status: PaymentStatus.FAILED }, ctx.prisma);
      return failure(new PaymentProviderError("The payment could not be started. Please try again in a moment."));
    }
  } catch (error) {
    if (error instanceof PaymentError) return failure(error);
    // Stripe/DB details stay in the log; the client only gets a generic message (a Stripe error
    // can name the account configuration, e.g. "Invalid API Key provided: sk_live_****").
    logger.error(`[createCheckoutIntent] Checkout failed for user ${input.userId}`, error);
    return failure(new PaymentProviderError("The payment could not be started. Please try again in a moment."));
  }
}

type CheckoutUser = { id: string; language: string | null; stripeCustomerId: string | null };

/**
 * Creates the intent of a local payment row. The idempotency key is the payment id, so a
 * concurrent request for the same row (or a retry after a crash between the two writes) gets the
 * same intent back from Stripe instead of a second one.
 */
async function createIntentFor(payment: PaymentDto, user: CheckoutUser, ctx: AppContext): Promise<Stripe.PaymentIntent> {
  const repo = new PaymentRepository();
  const intent = await getStripeClient().paymentIntents.create({
    amount: payment.amountMinor,
    currency: PaymentPolicy.getStripeCurrency(payment.currency),
    customer: user.stripeCustomerId ?? undefined,
    description: isPremiumPassPayment(payment.metadata) ? patronIntentDescription(user.language) : tipIntentDescription(user.language),
    metadata: {
      userId: user.id,
      paymentId: payment.id,
      ...(isPremiumPassPayment(payment.metadata) ? { purpose: PAYMENT_PURPOSE_PREMIUM_PASS } : {}),
      ...(isPremiumPassPayment(payment.metadata) && typeof payment.metadata?.productId === "string" ? { productId: payment.metadata.productId } : {}),
      ...(payment.requestId ? { requestId: payment.requestId } : {}),
      creatorId: payment.creatorId,
    },
    // Stripe decides which methods apply (dashboard settings, currency, amount); the tip gate
    // reads them back from `payment_method_types` to draw its tiles.
    automatic_payment_methods: { enabled: true },
  }, {
    idempotencyKey: `payment-intent-${payment.id}`,
  });
  await repo.updatePayment(payment.id, { stripeIntentId: intent.id }, ctx.prisma);
  return intent;
}

/** Same attempt again (Back → new amount, a retried request, a re-opened gate in the same tab). */
async function reuseAttempt(
  existing: PaymentDto,
  input: CreateCheckoutIntentInput,
  user: CheckoutUser,
  ctx: AppContext,
): Promise<UseCaseResult<CheckoutResultDto, CheckoutError>> {
  const repo = new PaymentRepository();
  const stripe = getStripeClient();
  const currency = PaymentPolicy.getDbCurrency(input.currency);

  // patron zone: a tip attempt and a patron-zone attempt never touch each other's payment. Otherwise the
  // tip route (its own, lower limits) could re-price a patron payment through its request id.
  if (isPremiumPassPayment(existing.metadata) !== (input.purpose === PAYMENT_PURPOSE_PREMIUM_PASS)) {
    return failure(new InvalidPaymentRequestError("This payment attempt belongs to another flow."));
  }

  // Paid, failed to start, canceled: the client starts a fresh attempt with a new requestId.
  if (existing.status !== PaymentStatus.PENDING) {
    return success(terminal(existing));
  }

  // The row exists but its intent isn't recorded yet: another request is creating it right now,
  // or that request crashed. The same idempotency key yields the same intent either way.
  let intent = existing.stripeIntentId
    ? await stripe.paymentIntents.retrieve(existing.stripeIntentId)
    : await createIntentFor(existing, user, ctx);

  if (intent.status === "canceled" || intent.status === "succeeded") {
    // succeeded: the webhook/fast path records it; canceled: abandoned. Either way, not reusable.
    if (intent.status === "canceled") await repo.markUnpaidPaymentCanceled(existing.id, ctx.prisma);
    return success(terminal({ ...existing, status: intent.status === "canceled" ? PaymentStatus.CANCELED : PaymentStatus.SUCCEEDED }));
  }

  // patron zone: another product on the same attempt moves the amount AND the product id together.
  const existingMeta = (existing.metadata && typeof existing.metadata === "object" ? existing.metadata : {}) as Record<string, unknown>;
  const productChanged = Boolean(input.purpose && input.productId && existingMeta.productId !== input.productId);
  const changed = existing.amountMinor !== input.amountMinor || existing.currency !== currency || productChanged;
  if (!changed) return success(ready(existing.id, intent));

  if (!UPDATABLE_INTENT_STATES.has(intent.status)) {
    // requires_action (BLIK/3DS waiting in the bank app) or processing: the amount can't move now.
    return failure(new PaymentInProgressError());
  }

  // Stripe first, then the row: if the row update fails the client gets an error and retries,
  // and fulfillPayment's amount check refuses to record a mismatched row in the meantime.
  intent = await stripe.paymentIntents.update(intent.id, {
    amount: input.amountMinor,
    currency: PaymentPolicy.getStripeCurrency(currency),
    ...(productChanged ? { metadata: { productId: input.productId! } } : {}),
  });
  const count = await repo.updatePendingPaymentAmount(existing.id, input.amountMinor, currency, ctx.prisma, productChanged ? { ...existingMeta, productId: input.productId } : undefined);
  if (count === 0) {
    // The row stopped being PENDING in between (paid or canceled): treat as finished.
    const current = await repo.findById(existing.id, ctx.db.read);
    return success(terminal(current ?? existing));
  }
  logger.info(`[createCheckoutIntent] Updated intent of payment ${existing.id} to the new amount.`);
  return success(ready(existing.id, intent));
}
