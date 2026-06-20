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
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCheckoutIntentInput {
  userId: string;
  amountMinor: number;
  currency: string;
  title: string;
  requestId?: string;
}

export interface CheckoutResultDto {
  paymentId: string;
  clientSecret: string | null;
  status?: PaymentStatus;
  terminal?: boolean;
}
