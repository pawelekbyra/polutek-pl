import { PaymentStatus } from "@prisma/client";
import type { PAYMENT_PURPOSE_PREMIUM_PASS } from "./payment.purpose";

export interface PaymentDto {
  id: string;
  userId: string;
  creatorId: string;
  amountMinor: number;
  currency: string;
  status: PaymentStatus;
  stripeIntentId: string | null;
  requestId: string | null;
  refundedAmountMinor: number | null;
  refundedById?: string | null;
  refundsCheckedAt?: Date | null;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCheckoutIntentInput {
  userId: string;
  amountMinor: number;
  currency: string;
  requestId?: string;
  /** Set by the patron zone (experiment: premium-pass); absent for a tip. */
  purpose?: typeof PAYMENT_PURPOSE_PREMIUM_PASS;
  /** The patron-zone product (the server's own table): carried in the Payment and PaymentIntent metadata. */
  productId?: string;
}

export interface CheckoutResultDto {
  paymentId: string;
  clientSecret: string | null;
  /**
   * The methods Stripe allows for this intent (dashboard settings + currency + amount), used by
   * the tip gate to draw its method tiles. Wallets (Apple/Google Pay) show up as `card`.
   */
  paymentMethodTypes?: string[];
  status?: PaymentStatus;
  terminal?: boolean;
}
