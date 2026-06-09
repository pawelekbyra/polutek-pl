import { PaymentStatus } from "@prisma/client";

export type AdminPaymentListItemDto = {
  id: string;
  userId: string;
  email: string;
  userName: string | null;
  amountMinor: number;
  refundedAmountMinor: number;
  currency: string;
  status: string;
  stripeIntentId: string | null;
  stripeSessionId: string | null;
  createdAt: string;
  updatedAt: string;
  metadata?: unknown;
  creator?: {
    id: string;
    name: string | null;
    slug: string | null;
  } | null;
};

export type AdminPaymentsListResponseDto = {
  items: AdminPaymentListItemDto[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  summary?: {
    totalSucceeded: Array<{ currency: string; amountMinor: number }>;
    totalRefunded: Array<{ currency: string; amountMinor: number }>;
    countByStatus: Record<string, number>;
  };
};

export const PAYMENT_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'amountMinor',
  'status',
  'currency'
] as const;

export type PaymentSortField = typeof PAYMENT_SORT_FIELDS[number];

export interface PaymentFilterOptions {
  userId?: string;
  creatorId?: string;
  status?: PaymentStatus;
  currency?: string;
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
  refundedOnly?: boolean;
  page?: number;
  pageSize?: number;
  orderBy?: string;
  orderDir?: 'asc' | 'desc';
}
