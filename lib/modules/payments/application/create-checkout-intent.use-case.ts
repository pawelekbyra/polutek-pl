import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok as success, fail as failure } from "@/lib/modules/shared/result";
import { PaymentStatus } from "@prisma/client";
import { CreateCheckoutIntentInput, CheckoutResultDto } from "../domain/payment.dto";
import { PaymentPolicy } from "../domain/payment.policy";
import { InvalidPaymentRequestError, UserNotFoundError, PaymentProviderError } from "../domain/payment.errors";
import { PaymentRepository } from "../infrastructure/payment.repository";
import { MainChannelService } from "@/lib/modules/channel";
import Stripe from 'stripe';
import { logger } from "@/lib/logger";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is missing');
  }
  return new Stripe(key);
}

export async function createCheckoutIntent(
  input: CreateCheckoutIntentInput,
  ctx: AppContext
): Promise<UseCaseResult<CheckoutResultDto, InvalidPaymentRequestError | UserNotFoundError | PaymentProviderError>> {
  if (!PaymentPolicy.canCreateCheckout(ctx.actor)) {
    return failure(new InvalidPaymentRequestError("Actor not authorized to create checkout intent."));
  }

  const repo = new PaymentRepository();
  const stripe = getStripe();

  // 1. Resolve user and main channel
  const user = await repo.findUser(input.userId, ctx.db.read);
  if (!user) return failure(new UserNotFoundError(input.userId));

  const mainChannel = await MainChannelService.getRequired(ctx);
  const creatorId = mainChannel.id;

  // 2. Idempotency check
  if (input.requestId) {
    const existing = await repo.findPaymentByRequestId(input.userId, input.requestId, ctx.db.read);
    if (existing) {
      if (existing.status !== PaymentStatus.PENDING) {
        logger.info(`[createCheckoutIntent] Terminal payment ${existing.id} reused for request ${input.requestId}; requiring a new requestId for another attempt.`);
        return success({
          paymentId: existing.id,
          clientSecret: null,
          status: existing.status,
          terminal: true,
        });
      }
      if (existing.stripeIntentId) {
        try {
          const intent = await stripe.paymentIntents.retrieve(existing.stripeIntentId);
          logger.info(`[createCheckoutIntent] Deduplicated request ${input.requestId} for user ${input.userId}.`);
          return success({
            paymentId: existing.id,
            clientSecret: intent.client_secret,
          });
        } catch (e) {
          logger.error(`[createCheckoutIntent] Error retrieving existing intent ${existing.stripeIntentId}`, e);
        }
      }
    }
  }

  // 3. Ensure Stripe Customer
  let stripeCustomerId = user.stripeCustomerId;
  if (!stripeCustomerId) {
    try {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: user.id }
      });
      stripeCustomerId = customer.id;
      await repo.updateStripeCustomerId(user.id, stripeCustomerId, ctx.prisma); // Use ctx.prisma for direct write if repository doesn't have a simple method that takes db/tx
    } catch (e) {
      logger.error(`[createCheckoutIntent] Error creating Stripe customer`, e);
      return failure(new PaymentProviderError("Failed to create payment provider customer."));
    }
  }

  // 4. Create local payment record
  const payment = await repo.createPayment({
    userId: user.id,
    creatorId,
    amountMinor: input.amountMinor,
    currency: PaymentPolicy.getDbCurrency(input.currency),
    status: PaymentStatus.PENDING,
    metadata: input.requestId ? { requestId: input.requestId } : {},
    requestId: input.requestId ?? null,
  }, ctx.prisma);

  // 5. Create Stripe Payment Intent
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: input.amountMinor,
      currency: PaymentPolicy.getStripeCurrency(input.currency),
      customer: stripeCustomerId,
      description: input.title,
      metadata: {
        userId: user.id,
        paymentId: payment.id,
        ...(input.requestId ? { requestId: input.requestId } : {}),
        creatorId,
      },
      automatic_payment_methods: { enabled: true },
    }, {
      idempotencyKey: input.requestId ? `payment-intent-${user.id}-${input.requestId}` : undefined
    });

    await repo.updatePayment(payment.id, { stripeIntentId: paymentIntent.id }, ctx.prisma);

    return success({
      paymentId: payment.id,
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    logger.error(`[createCheckoutIntent] Error creating Stripe intent`, error);
    await repo.updatePayment(payment.id, { status: PaymentStatus.FAILED }, ctx.prisma);
    return failure(new PaymentProviderError(error instanceof Error ? error.message : "Failed to create payment provider intent."));
  }
}
