import { WebhookEventStatus } from "@prisma/client";

export interface StripeEventDto {
  id: string;
  type: string;
  status: WebhookEventStatus;
  payload: any;
  error: string | null;
  processedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
