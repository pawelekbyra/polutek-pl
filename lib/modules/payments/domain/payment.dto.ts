import { PaymentStatus } from "@prisma/client";

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
