import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ResendAudienceGateway } from '@/lib/modules/subscriptions/infrastructure/resend-audience.gateway';

const resend = {
  contacts: {
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
};

describe('ResendAudienceGateway explicit consent sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESEND_AUDIENCE_ID = 'aud_123';
    process.env.RESEND_API_KEY = 're_123';
  });

  it('returns NOT_CONFIGURED when Audience is missing', async () => {
    delete process.env.RESEND_AUDIENCE_ID;
    const gateway = new ResendAudienceGateway(resend as any);

    await expect(gateway.syncExplicitSubscribe('user@example.com')).resolves.toBe('NOT_CONFIGURED');
    await expect(gateway.syncExplicitUnsubscribe('user@example.com')).resolves.toBe('NOT_CONFIGURED');
    expect(resend.contacts.create).not.toHaveBeenCalled();
    expect(resend.contacts.update).not.toHaveBeenCalled();
  });

  it('returns FAILED when API Key is missing but Audience exists', async () => {
    delete process.env.RESEND_API_KEY;
    const gateway = new ResendAudienceGateway(); // No injection, will use getClient()

    await expect(gateway.syncExplicitSubscribe('user@example.com')).resolves.toBe('FAILED');
    await expect(gateway.syncExplicitUnsubscribe('user@example.com')).resolves.toBe('FAILED');
  });

  it('updates existing contact to subscribed only in explicit subscribe flow', async () => {
    resend.contacts.get.mockResolvedValue({ data: { id: 'contact_1' }, error: null });
    resend.contacts.update.mockResolvedValue({ data: { id: 'contact_1' }, error: null });
    const gateway = new ResendAudienceGateway(resend as any);

    const status = await gateway.syncExplicitSubscribe('user@example.com');

    expect(status).toBe('SYNCED');
    expect(resend.contacts.update).toHaveBeenCalledWith({ email: 'user@example.com', audienceId: 'aud_123', unsubscribed: false });
    expect(resend.contacts.create).not.toHaveBeenCalled();
  });

  it('creates subscribed contact after explicit subscribe when no existing contact is returned (404)', async () => {
    resend.contacts.get.mockResolvedValue({ data: null, error: { statusCode: 404 } });
    resend.contacts.create.mockResolvedValue({ data: { id: 'contact_1' }, error: null });
    const gateway = new ResendAudienceGateway(resend as any);

    const status = await gateway.syncExplicitSubscribe('user@example.com');

    expect(status).toBe('SYNCED');
    expect(resend.contacts.create).toHaveBeenCalledWith({ email: 'user@example.com', audienceId: 'aud_123', unsubscribed: false });
  });

  it('handles conflict during create by retrying update', async () => {
    resend.contacts.get.mockResolvedValue({ data: null, error: { statusCode: 404 } });
    resend.contacts.create.mockResolvedValue({ data: null, error: { statusCode: 409, message: 'Already exists' } });
    resend.contacts.update.mockResolvedValue({ data: { id: 'contact_1' }, error: null });
    const gateway = new ResendAudienceGateway(resend as any);

    const status = await gateway.syncExplicitSubscribe('user@example.com');

    expect(status).toBe('SYNCED');
    expect(resend.contacts.create).toHaveBeenCalled();
    expect(resend.contacts.update).toHaveBeenCalledWith({ email: 'user@example.com', audienceId: 'aud_123', unsubscribed: false });
  });

  it('returns FAILED when subscribe provider sync fails (generic error)', async () => {
    resend.contacts.get.mockRejectedValue(new Error('down'));
    const gateway = new ResendAudienceGateway(resend as any);

    await expect(gateway.syncExplicitSubscribe('user@example.com')).resolves.toBe('FAILED');
  });

  it('marks provider contact unsubscribed without setting unsubscribed false', async () => {
    resend.contacts.update.mockResolvedValue({ data: { id: 'contact_1' }, error: null });
    const gateway = new ResendAudienceGateway(resend as any);

    const status = await gateway.syncExplicitUnsubscribe('user@example.com');

    expect(status).toBe('SYNCED');
    expect(resend.contacts.update).toHaveBeenCalledWith({ email: 'user@example.com', audienceId: 'aud_123', unsubscribed: true });
    expect(resend.contacts.create).not.toHaveBeenCalled();
  });

  it('treats missing provider contact as idempotent unsubscribe success', async () => {
    resend.contacts.update.mockResolvedValue({ data: null, error: { statusCode: 404, message: 'not found' } });
    const gateway = new ResendAudienceGateway(resend as any);

    await expect(gateway.syncExplicitUnsubscribe('user@example.com')).resolves.toBe('SYNCED');
  });

  it('never throws exceptions outside of the gateway', async () => {
    resend.contacts.get.mockRejectedValue('Fatal subscribe error');
    resend.contacts.update.mockRejectedValue('Fatal unsubscribe error');
    const gateway = new ResendAudienceGateway(resend as any);

    await expect(gateway.syncExplicitSubscribe('user@example.com')).resolves.toBe('FAILED');
    await expect(gateway.syncExplicitUnsubscribe('user@example.com')).resolves.toBe('FAILED');
  });
});
