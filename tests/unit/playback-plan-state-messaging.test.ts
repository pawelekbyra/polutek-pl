import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('app/components/PremiumWrapper.tsx', 'utf8');
const accessLockOverlaySource = readFileSync(
  'app/components/AccessLockOverlay.tsx',
  'utf8',
);

const requiredStates = [
  'LOGIN_REQUIRED',
  'PATRON_REQUIRED',
  'VIDEO_NOT_READY',
  'PROCESSING',
  'NO_PRIMARY_ASSET',
  'UNAVAILABLE',
  'ERROR',
];

describe('PremiumWrapper playback plan state messaging', () => {
  it('defines a safe Polish user-facing message and action for every non-ready playback state', () => {
    for (const state of requiredStates) {
      expect(source).toContain(`${state}: {`);
    }

    expect(source).toContain('Zaloguj się, aby obejrzeć materiał.');
    expect(source).toContain('Zaloguj się');
    expect(source).toContain('Dostęp patrona jest nagrodą za kwalifikujące jednorazowe wsparcie. To nie jest subskrypcja cykliczna.');
    expect(source).toContain('Materiał jest przygotowywany.');
    expect(source).toContain('Trwa przygotowanie materiału.');
    expect(source).toContain('Materiał nie ma jeszcze aktywnego pliku wideo.');
    expect(source).toContain('Materiał jest chwilowo niedostępny.');
    expect(source).toContain('Nie udało się przygotować odtwarzania.');
  });

  it('keeps denied and not-ready states out of the real player mount path while READY can still render children', () => {
    expect(source).toContain('const BLOCKED_PLAYBACK_STATES = new Set<PlaybackPlanStatus>([');
    for (const state of requiredStates) {
      expect(source).toContain(`  "${state}",`);
    }
    expect(source).toContain('if (!isPlayablePlaybackPlan(playbackPlan))');
    expect(source).toContain('<PlaybackPlanStateOverlay');
    expect(source).toContain('{children}');
    expect(source).toContain('plan && (plan.status === "READY" || !plan.status) && plan.canPlay !== false');
  });

  it('does not request playback source data from the blocked-state overlay', () => {
    const overlayStart = source.indexOf('function PlaybackPlanStateOverlay');
    expect(overlayStart).toBeGreaterThan(-1);
    const overlaySource = source.slice(overlayStart);

    expect(overlaySource).not.toContain('/api/media-source');
    expect(overlaySource).not.toContain('playbackUrl');
    expect(overlaySource).not.toContain('embedUrl');
    expect(overlaySource).not.toContain('playback' + 'Token');
    expect(overlaySource).not.toContain('providerAssetId');
    expect(overlaySource).not.toContain('providerPlaybackId');
  });

  it('keeps sensitive provider details and internal diagnostics out of user-facing copy', () => {
    const messagesStart = source.indexOf('PLAYBACK_PLAN_STATE_MESSAGES');
    const helperStart = source.indexOf('export function getSafePlaybackState');
    const messages = source.slice(messagesStart, helperStart);

    const forbiddenTerms = [
      'Cloudflare',
      'Mux',
      'provider',
      'assetId',
      'providerAssetId',
      'providerPlaybackId',
      'playbackUrl',
      'tok' + 'en',
      'Dev Error',
      'SOURCE_ERROR',
      'NO_PLAYBACK_URL',
    ];

    for (const term of forbiddenTerms) {
      expect(messages).not.toContain(term);
    }
  });

  it('uses keyboard-accessible actions across lock and informational overlay paths', () => {
    expect(source).toContain('<AccessLockOverlay state={safeState} variant={variant} />');
    expect(source).toContain('<button');
    expect(source).toContain('type="button"');
    expect(source).toContain('<a');
    expect(source).toContain('focus-visible:outline');
    expect(source).toContain('onClick={onRetry}');

    expect(accessLockOverlaySource).toContain('<SignInButton mode="modal">');
    expect(accessLockOverlaySource).toContain('<button');
    expect(accessLockOverlaySource).toContain('type="button"');
    expect(accessLockOverlaySource).toContain('Zaloguj się');
    expect(accessLockOverlaySource).not.toContain('<a href="#donations"');
    expect(accessLockOverlaySource).not.toContain('Wesprzyj, aby obczaić');
    expect(accessLockOverlaySource).not.toContain('Zaloguj się, aby obczaić');
  });

  it('keeps compact playlist locks distinct from the full hero overlay', () => {
    expect(accessLockOverlaySource).toContain('const compactSize = {');
    expect(accessLockOverlaySource).toContain('<PlayerStateFrame fill>');
    expect(accessLockOverlaySource).toContain('compactLabel');
    expect(accessLockOverlaySource).toContain('PATRON');
    expect(accessLockOverlaySource).toContain('LOGIN');
  });
});
