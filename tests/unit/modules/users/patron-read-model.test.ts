import { describe, it, expect } from 'vitest';
import { buildPatronDiagnosticsReadModel } from '@/lib/modules/users/application/patron-read-model';

describe('Patron Read Model Diagnostics', () => {
  it('returns ACTIVE_GRANT status when active grants exist', () => {
    const grants = [
      { id: 'g1', source: 'admin', createdAt: new Date('2024-01-01'), revokedAt: null }
    ];

    const diagnostics = buildPatronDiagnosticsReadModel(grants);

    expect(diagnostics.finalPatronStatus).toBe('ACTIVE_GRANT');
    expect(diagnostics.finalPatronStatusSource).toBe('ACTIVE_PATRON_GRANT');
    expect(diagnostics.truth.isPatron).toBe(true);
  });

  it('returns NO_ACTIVE_GRANT status when no active grants exist', () => {
    const grants = [
      { id: 'g1', source: 'admin', createdAt: new Date('2024-01-01'), revokedAt: new Date('2025-01-01') }
    ];

    const diagnostics = buildPatronDiagnosticsReadModel(grants);

    expect(diagnostics.finalPatronStatus).toBe('NO_ACTIVE_GRANT');
    expect(diagnostics.truth.isPatron).toBe(false);
  });

  it('exposes correct activeGrantSince from first active grant', () => {
    const date = new Date('2024-01-01');
    const grants = [
      { id: 'g1', source: 'stripe_tip', createdAt: date, revokedAt: null }
    ];

    const diagnostics = buildPatronDiagnosticsReadModel(grants);

    expect(diagnostics.truth.activeGrantSince).toEqual(date);
    expect(diagnostics.truth.activeGrantSource).toBe('stripe_tip');
  });

  it('returns null activeGrantSince when no grants at all', () => {
    const diagnostics = buildPatronDiagnosticsReadModel([]);

    expect(diagnostics.finalPatronStatus).toBe('NO_ACTIVE_GRANT');
    expect(diagnostics.truth.isPatron).toBe(false);
    expect(diagnostics.truth.activeGrantSince).toBeNull();
    expect(diagnostics.truth.activeGrantSource).toBeNull();
  });

  it('counts only active grants in activeGrantCount', () => {
    const grants = [
      { id: 'g1', source: 'admin', createdAt: new Date('2023-01-01'), revokedAt: new Date('2024-01-01') },
      { id: 'g2', source: 'stripe_tip', createdAt: new Date('2024-06-01'), revokedAt: null },
    ];

    const diagnostics = buildPatronDiagnosticsReadModel(grants);

    expect(diagnostics.truth.activeGrantCount).toBe(1);
    expect(diagnostics.truth.activeGrantIds).toEqual(['g2']);
  });
});
