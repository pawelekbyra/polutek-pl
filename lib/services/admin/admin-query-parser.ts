import { NextRequest } from 'next/server';
import { VIDEO_SORT_FIELDS, VideoSortField } from './videos-admin.dto';
import { PAYMENT_SORT_FIELDS, PaymentSortField } from './payments-admin.dto';
import { VideoStatus, AccessTier, SystemRole, PatronGrantSource, PaymentStatus } from '@prisma/client';

export const USER_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'email',
  'name',
  'patronSince',
  'role'
] as const;

export type UserSortField = typeof USER_SORT_FIELDS[number];

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

export function parseVideoQueryParams(req: NextRequest) {
  const base = parsePaginationParams(req, 'createdAt');
  const { searchParams } = new URL(req.url);

  if (!VIDEO_SORT_FIELDS.includes(base.orderBy as VideoSortField)) {
    base.orderBy = 'createdAt';
  }

  return {
    ...base,
    status: searchParams.get('status') as VideoStatus || undefined,
    tier: searchParams.get('tier') as AccessTier || undefined,
    isMainFeatured: searchParams.get('isMainFeatured') === 'true' ? true : searchParams.get('isMainFeatured') === 'false' ? false : undefined,
    showInSidebar: searchParams.get('showInSidebar') === 'true' ? true : searchParams.get('showInSidebar') === 'false' ? false : undefined,
    sourceKind: searchParams.get('sourceKind') || undefined,
    migrationStatus: searchParams.get('migrationStatus') || undefined,
    needsAttention: searchParams.get('needsAttention') === 'true' ? true : undefined,
  };
}

export function parseUserQueryParams(req: NextRequest) {
  const base = parsePaginationParams(req, 'createdAt');
  const { searchParams } = new URL(req.url);

  if (!USER_SORT_FIELDS.includes(base.orderBy as UserSortField)) {
    base.orderBy = 'createdAt';
  }

  return {
    ...base,
    role: searchParams.get('role') as SystemRole || undefined,
    isPatron: searchParams.get('isPatron') === 'true' ? true : searchParams.get('isPatron') === 'false' ? false : undefined,
    patronSource: searchParams.get('patronSource') as PatronGrantSource || undefined,
    isDeleted: searchParams.get('isDeleted') === 'true' ? true : searchParams.get('isDeleted') === 'false' ? false : undefined,
    language: searchParams.get('language') || undefined,
    hasPayments: searchParams.get('hasPayments') === 'true' ? true : undefined,
    hasSubscriptions: searchParams.get('hasSubscriptions') === 'true' ? true : undefined,
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
  };
}
