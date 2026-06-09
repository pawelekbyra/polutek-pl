import { NextRequest } from 'next/server';
import { SystemRole, PatronGrantSource } from '@prisma/client';

export interface AdminUsersExportFilters {
  query?: string;
  role?: SystemRole;
  isPatron?: boolean;
  patronSource?: PatronGrantSource;
  isDeleted?: boolean;
  language?: string;
  hasPayments?: boolean;
  hasSubscriptions?: boolean;
}

export function parseAdminUsersExportQueryParams(req: NextRequest): AdminUsersExportFilters {
  const { searchParams } = new URL(req.url);

  return {
    query: searchParams.get('query') || searchParams.get('search') || undefined,
    role: searchParams.get('role') as SystemRole || undefined,
    isPatron: searchParams.get('isPatron') === 'true' ? true : searchParams.get('isPatron') === 'false' ? false : undefined,
    patronSource: searchParams.get('patronSource') as PatronGrantSource || undefined,
    isDeleted: searchParams.get('isDeleted') === 'true' ? true : searchParams.get('isDeleted') === 'false' ? false : undefined,
    language: searchParams.get('language') || undefined,
    hasPayments: searchParams.get('hasPayments') === 'true' ? true : undefined,
    hasSubscriptions: searchParams.get('hasSubscriptions') === 'true' ? true : undefined,
  };
}
