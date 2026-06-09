import { NextRequest } from 'next/server';
import { PaymentStatus } from '@prisma/client';
import { PAYMENT_SORT_FIELDS, PaymentSortField } from '@/lib/modules/payments/domain/admin-payment.dto';

export type BasePaginationOptions = {
  page: number;
  pageSize: number;
  query?: string;
  orderBy: string;
  orderDir: 'asc' | 'desc';
};

export function parsePaginationParams(req: NextRequest, defaultSort: string): BasePaginationOptions {
  const { searchParams } = new URL(req.url);
  return {
    page: Math.max(1, parseInt(searchParams.get('page') || '1')),
    pageSize: Math.max(1, Math.min(100, parseInt(searchParams.get('pageSize') || '20'))),
    query: searchParams.get('query') || searchParams.get('search') || undefined,
    orderBy: searchParams.get('orderBy') || defaultSort,
    orderDir: (searchParams.get('orderDir') as 'asc' | 'desc') || 'desc',
  };
}

export function parsePaymentQueryParams(req: NextRequest) {
  const base = parsePaginationParams(req, 'createdAt');
  const { searchParams } = new URL(req.url);

  if (!PAYMENT_SORT_FIELDS.includes(base.orderBy as PaymentSortField)) {
    base.orderBy = 'createdAt';
  }

  return {
    ...base,
    status: searchParams.get('status') as PaymentStatus || undefined,
    currency: searchParams.get('currency') || undefined,
    dateFrom: searchParams.get('dateFrom') ? new Date(searchParams.get('dateFrom')!) : undefined,
    dateTo: searchParams.get('dateTo') ? new Date(searchParams.get('dateTo')!) : undefined,
    refundedOnly: searchParams.get('refundedOnly') === 'true' ? true : undefined,
    search: base.query
  };
}
