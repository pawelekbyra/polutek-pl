import { PatronGrantSource } from '@prisma/client';

export type PatronGrantSourceInput = 'stripe_tip' | 'admin' | 'migration';

export interface PatronGrantDto {
  id: string;
  userId: string;
  source: PatronGrantSource;
  paymentId: string | null;
  grantedById: string | null;
  reason: string | null;
  createdAt: Date;
  revokedAt: Date | null;
}

export interface PatronStatusDto {
  userId: string;
  isPatron: boolean;
  patronSince: Date | null;
  patronSource: PatronGrantSource | null;
  activeGrants: PatronGrantDto[];
  normalizedTotal: number;
}

export interface GrantPatronInput {
  userId: string;
  source: PatronGrantSourceInput;
  note?: string;
  grantedByUserId?: string;
  paymentId?: string;
}

export interface RevokePatronInput {
  userId: string;
  note?: string;
  revokedByUserId?: string;
  paymentId?: string;
}
