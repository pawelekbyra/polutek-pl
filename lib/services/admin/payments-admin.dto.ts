export type AdminPaymentListItem = {
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
  metadata?: any;
};

export type AdminPaymentsListResponse = {
  items: AdminPaymentListItem[];
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
