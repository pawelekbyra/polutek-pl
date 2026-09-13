import { PatronGrantDto, PatronStatusDto } from "./patron.dto";

/**
 * Canonical "patron truth" derivation: PatronGrant rows in, a read model out.
 *
 * This is the single place that decides isPatron / patronSince / patronSource
 * from a set of grants (per CLAUDE.md §4.1, PatronGrant is the sole source of
 * truth — these fields must always be DERIVED here, never cached/stored).
 * Every use case in this module, and the admin user read models in
 * `users/application`, must build their response shape through this function
 * (or `buildPatronStatusDto` below) instead of reimplementing the derivation.
 */
export interface PatronTruthReadModel<TSource extends string = string> {
  isPatron: boolean;
  activeGrantCount: number;
  activeGrantIds: string[];
  activeGrantSince: Date | null;
  activeGrantSource: TSource | null;
  firstActiveGrantAt: Date | null;
  latestActiveGrantAt: Date | null;
  source: TSource | null;
  truthSource: 'ACTIVE_PATRON_GRANT';
}

export interface PatronDiagnosticsReadModel<TSource extends string = string> {
  finalPatronStatus: 'ACTIVE_GRANT' | 'NO_ACTIVE_GRANT';
  finalPatronStatusSource: 'ACTIVE_PATRON_GRANT';
  truth: PatronTruthReadModel<TSource>;
}

export function buildPatronTruthReadModel<TSource extends string>(
  patronGrants: Array<{
    id: string;
    source: TSource;
    createdAt: Date;
    revokedAt: Date | null;
  }>
): PatronTruthReadModel<TSource> {
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

export function buildPatronDiagnosticsReadModel<TSource extends string>(
  patronGrants: Array<{
    id: string;
    source: TSource;
    createdAt: Date;
    revokedAt: Date | null;
  }>
): PatronDiagnosticsReadModel<TSource> {
  const truth = buildPatronTruthReadModel(patronGrants);

  return {
    finalPatronStatus: truth.isPatron ? 'ACTIVE_GRANT' : 'NO_ACTIVE_GRANT',
    finalPatronStatusSource: 'ACTIVE_PATRON_GRANT',
    truth,
  };
}

/**
 * Assembles the full `PatronStatusDto` returned by the patron use cases
 * (grant / revoke / recalculate / get-status) from a caller-supplied set of
 * already-active grants plus the user's normalized payment total.
 *
 * `activeGrants` is expected to already be the active-only (revokedAt: null)
 * set (as returned by `PatronRepository.listActiveGrants`), but this still
 * goes through `buildPatronTruthReadModel` rather than reading
 * `activeGrants[0]` directly, so the isPatron/patronSince/patronSource
 * derivation stays defined in exactly one place.
 */
export function buildPatronStatusDto(params: {
  userId: string;
  activeGrants: PatronGrantDto[];
  normalizedTotal: number;
}): PatronStatusDto {
  const truth = buildPatronTruthReadModel(params.activeGrants);

  return {
    userId: params.userId,
    isPatron: truth.isPatron,
    patronSince: truth.activeGrantSince,
    patronSource: truth.activeGrantSource,
    activeGrants: params.activeGrants,
    normalizedTotal: params.normalizedTotal,
  };
}
