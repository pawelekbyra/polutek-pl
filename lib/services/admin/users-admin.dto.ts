export type AdminUserListItem = {
  id: string;
  email: string;
  name: string | null;
  username: string | null;
  imageUrl: string | null;
  language: string | null;
  role: string;
  isDeleted: boolean;
  isPatron: boolean;
  patronSince: string | null;
  patronSource: string | null;
  hasSubscriptions: boolean;
  paymentCount: number;
  paymentTotals: Array<{
    currency: string;
    totalPaidMinor: number;
    refundedAmountMinor?: number;
  }>;
  lastPaymentAt: string | null;
  referralPoints: number;
  referralCount: number;
  createdAt: string;
  updatedAt: string;
};

export type AdminUsersListResponse = {
  items: AdminUserListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  stats?: Record<string, unknown>;
};

export const USER_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'email',
  'name',
  'patronSince',
  'referralPoints',
  'referralCount',
  'role'
] as const;

export type UserSortField = typeof USER_SORT_FIELDS[number];
