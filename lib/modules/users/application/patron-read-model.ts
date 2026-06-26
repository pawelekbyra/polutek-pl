export interface PatronTruthReadModel {
  isPatron: boolean;
  activeGrantCount: number;
  activeGrantIds: string[];
  activeGrantSince: Date | null;
  activeGrantSource: string | null;
  firstActiveGrantAt: Date | null;
  latestActiveGrantAt: Date | null;
  source: string | null;
  truthSource: 'ACTIVE_PATRON_GRANT';
}

export interface PatronDiagnosticsReadModel {
  finalPatronStatus: 'ACTIVE_GRANT' | 'NO_ACTIVE_GRANT';
  finalPatronStatusSource: 'ACTIVE_PATRON_GRANT';
  truth: PatronTruthReadModel;
  /** Legacy cache data from User table for diagnostic purposes. */
  legacyPatronCache: {
    isPatron: boolean;
    patronSince: Date | null;
    patronSource: string | null;
  };
  /** Indicates if the legacy cache differs from the current source of truth in terms of access. */
  accessTruthMismatch: boolean;
  /** Alias for accessTruthMismatch for backward compatibility. */
  cacheTruthMismatch: boolean;
  /** Indicates if the legacy cache metadata (since, source) differs from the current source of truth. */
  legacyMetadataMismatch: boolean;
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
    activeGrantSince: firstActiveGrant?.createdAt ?? null,
    activeGrantSource: firstActiveGrant?.source ?? null,
    firstActiveGrantAt: firstActiveGrant?.createdAt ?? null,
    latestActiveGrantAt: latestActiveGrant?.createdAt ?? null,
    source: firstActiveGrant?.source ?? null,
    truthSource: 'ACTIVE_PATRON_GRANT',
  };
}

export function buildPatronDiagnosticsReadModel(
  patronGrants: Array<{
    id: string;
    source: string;
    createdAt: Date;
    revokedAt: Date | null;
  }>,
  legacyCache: {
    isPatron: boolean;
    patronSince: Date | null;
    patronSource: string | null;
  }
): PatronDiagnosticsReadModel {
  const truth = buildPatronTruthReadModel(patronGrants);

  const accessMismatch = truth.isPatron !== legacyCache.isPatron;
  const metadataMismatch =
    truth.activeGrantSince?.getTime() !== legacyCache.patronSince?.getTime() ||
    truth.activeGrantSource !== legacyCache.patronSource;

  return {
    finalPatronStatus: truth.isPatron ? 'ACTIVE_GRANT' : 'NO_ACTIVE_GRANT',
    finalPatronStatusSource: 'ACTIVE_PATRON_GRANT',
    truth,
    legacyPatronCache: legacyCache,
    accessTruthMismatch: accessMismatch,
    cacheTruthMismatch: accessMismatch, // Alias for accessTruthMismatch
    legacyMetadataMismatch: metadataMismatch,
  };
}
