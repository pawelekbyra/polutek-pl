export interface PatronCacheReadModel {
  isPatron: boolean;
  patronSince: Date | null;
  patronSource: string | null;
  readModelSource: 'USER_PATRON_CACHE';
}

export interface PatronTruthReadModel {
  isPatron: boolean;
  activeGrantCount: number;
  activeGrantIds: string[];
  firstActiveGrantAt: Date | null;
  latestActiveGrantAt: Date | null;
  source: string | null;
  truthSource: 'ACTIVE_PATRON_GRANT';
}

export interface PatronCacheTruthMismatchReadModel {
  hasMismatch: boolean;
  cacheSaysPatron: boolean;
  truthSaysPatron: boolean;
  cachePatronSince: Date | null;
  truthFirstActiveGrantAt: Date | null;
  cachePatronSource: string | null;
  truthActiveSource: string | null;
}

export interface PatronDiagnosticsReadModel {
  finalPatronStatus: 'ACTIVE_GRANT' | 'NO_ACTIVE_GRANT';
  finalPatronStatusSource: 'ACTIVE_PATRON_GRANT';
  cache: PatronCacheReadModel;
  truth: PatronTruthReadModel;
  cacheTruthMismatch: PatronCacheTruthMismatchReadModel;
}

export function buildPatronCacheReadModel(user: {
  isPatron: boolean;
  patronSince: Date | null;
  patronSource: string | null;
}): PatronCacheReadModel {
  return {
    isPatron: user.isPatron,
    patronSince: user.patronSince,
    patronSource: user.patronSource,
    readModelSource: 'USER_PATRON_CACHE',
  };
}

export function buildPatronTruthReadModel(
  patronGrants: Array<{
    id: string;
    source: string;
    createdAt: Date;
    revokedAt: Date | null;
  }>
): PatronTruthReadModel {
  const activeGrants = patronGrants
    .filter((grant) => grant.revokedAt === null)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  const firstActiveGrant = activeGrants[0] ?? null;
  const latestActiveGrant = activeGrants.length > 0 ? activeGrants[activeGrants.length - 1] : null;

  return {
    isPatron: activeGrants.length > 0,
    activeGrantCount: activeGrants.length,
    activeGrantIds: activeGrants.map((grant) => grant.id),
    firstActiveGrantAt: firstActiveGrant?.createdAt ?? null,
    latestActiveGrantAt: latestActiveGrant?.createdAt ?? null,
    source: firstActiveGrant?.source ?? null,
    truthSource: 'ACTIVE_PATRON_GRANT',
  };
}

export function buildPatronDiagnosticsReadModel(
  user: {
    isPatron: boolean;
    patronSince: Date | null;
    patronSource: string | null;
  },
  patronGrants: Array<{
    id: string;
    source: string;
    createdAt: Date;
    revokedAt: Date | null;
  }>
): PatronDiagnosticsReadModel {
  const cache = buildPatronCacheReadModel(user);
  const truth = buildPatronTruthReadModel(patronGrants);

  return {
    finalPatronStatus: truth.isPatron ? 'ACTIVE_GRANT' : 'NO_ACTIVE_GRANT',
    finalPatronStatusSource: 'ACTIVE_PATRON_GRANT',
    cache,
    truth,
    cacheTruthMismatch: {
      hasMismatch: cache.isPatron !== truth.isPatron,
      cacheSaysPatron: cache.isPatron,
      truthSaysPatron: truth.isPatron,
      cachePatronSince: cache.patronSince,
      truthFirstActiveGrantAt: truth.firstActiveGrantAt,
      cachePatronSource: cache.patronSource,
      truthActiveSource: truth.source,
    },
  };
}
