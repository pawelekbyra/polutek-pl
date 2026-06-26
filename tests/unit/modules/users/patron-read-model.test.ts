import { describe, it, expect } from 'vitest';
import { buildPatronDiagnosticsReadModel } from '@/lib/modules/users/application/patron-read-model';

describe('Patron Read Model Diagnostics', () => {
  it('identifies accessTruthMismatch when isPatron differs', () => {
    const grants = [
      { id: 'g1', source: 'admin', createdAt: new Date('2024-01-01'), revokedAt: null }
    ];
    const legacyCache = {
      isPatron: false,
      patronSince: new Date('2024-01-01'),
      patronSource: 'admin'
    };

    const diagnostics = buildPatronDiagnosticsReadModel(grants, legacyCache);

    expect(diagnostics.accessTruthMismatch).toBe(true);
    expect(diagnostics.cacheTruthMismatch).toBe(true); // alias
    // metadata matches, but access mismatch might override or be separate.
    // In our implementation, metadataMismatch is calculated independently.
    expect(diagnostics.legacyMetadataMismatch).toBe(false);
  });

  it('identifies legacyMetadataMismatch when metadata differs but access is same', () => {
    const date1 = new Date('2024-01-01');
    const date2 = new Date('2020-01-01');
    const grants = [
      { id: 'g1', source: 'stripe_tip', createdAt: date1, revokedAt: null }
    ];
    const legacyCache = {
      isPatron: true,
      patronSince: date2,
      patronSource: 'admin'
    };

    const diagnostics = buildPatronDiagnosticsReadModel(grants, legacyCache);

    expect(diagnostics.accessTruthMismatch).toBe(false);
    expect(diagnostics.cacheTruthMismatch).toBe(false);
    expect(diagnostics.legacyMetadataMismatch).toBe(true);
  });

  it('identifies both mismatches when both differ', () => {
    const grants = [
      { id: 'g1', source: 'stripe_tip', createdAt: new Date('2024-01-01'), revokedAt: null }
    ];
    const legacyCache = {
      isPatron: false,
      patronSince: new Date('2020-01-01'),
      patronSource: 'admin'
    };

    const diagnostics = buildPatronDiagnosticsReadModel(grants, legacyCache);

    expect(diagnostics.accessTruthMismatch).toBe(true);
    expect(diagnostics.legacyMetadataMismatch).toBe(true);
  });

  it('identifies no mismatch when everything is consistent', () => {
    const date = new Date('2024-01-01');
    const grants = [
      { id: 'g1', source: 'admin', createdAt: date, revokedAt: null }
    ];
    const legacyCache = {
      isPatron: true,
      patronSince: date,
      patronSource: 'admin'
    };

    const diagnostics = buildPatronDiagnosticsReadModel(grants, legacyCache);

    expect(diagnostics.accessTruthMismatch).toBe(false);
    expect(diagnostics.legacyMetadataMismatch).toBe(false);
  });
});
