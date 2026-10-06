import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { resendCtor } = vi.hoisted(() => ({ resendCtor: vi.fn() }));
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(function () {
    resendCtor();
    return { contacts: {} };
  }),
}));

import { ResendAudienceGateway } from '@/lib/modules/subscriptions/infrastructure/resend-audience.gateway';

describe('subscription flows with EMAIL_PROVIDER=ses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.EMAIL_PROVIDER = 'ses';
    // Even a fully configured Resend must not be used.
    process.env.RESEND_API_KEY = 're_123';
    process.env.RESEND_AUDIENCE_ID = 'aud_123';
  });
  afterEach(() => {
    delete process.env.EMAIL_PROVIDER;
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_AUDIENCE_ID;
  });

  it('subscribe, unsubscribe and contact removal need no Resend call and create no Resend client', async () => {
    const gateway = new ResendAudienceGateway();
    await expect(gateway.syncExplicitSubscribe('u@example.com')).resolves.toBe('NOT_CONFIGURED');
    await expect(gateway.syncExplicitUnsubscribe('u@example.com')).resolves.toBe('NOT_CONFIGURED');
    await expect(gateway.removeContact('u@example.com')).resolves.toBe('NOT_CONFIGURED');
    expect(resendCtor).not.toHaveBeenCalled();
  });

  it('an injected client is not called either', async () => {
    const client = { contacts: { get: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() } };
    const gateway = new ResendAudienceGateway(client as never);
    await gateway.syncExplicitSubscribe('u@example.com');
    await gateway.removeContact('u@example.com');
    expect(Object.values(client.contacts).every((fn) => fn.mock.calls.length === 0)).toBe(true);
  });

  it('with the default provider (resend) the gateway still builds a Resend client', async () => {
    delete process.env.EMAIL_PROVIDER;
    const gateway = new ResendAudienceGateway();
    await gateway.syncExplicitUnsubscribe('u@example.com'); // fails against the empty mock client, but must try
    expect(resendCtor).toHaveBeenCalled();
  });
});
