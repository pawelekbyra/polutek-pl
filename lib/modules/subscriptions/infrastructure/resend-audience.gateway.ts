import { Resend } from 'resend';
import { logger } from '@/lib/logger';
import { maskEmailForLog } from '../domain/email-address';
import { ProviderSyncStatus } from '../domain/provider-sync-status';

let resendClient: Resend | null = null;


function isMissingContactError(error: unknown): boolean {
  const candidate = error as { statusCode?: number; status?: number; message?: string } | null;
  const message = String(candidate?.message ?? '').toLowerCase();
  return candidate?.statusCode === 404 || candidate?.status === 404 || message.includes('not found');
}

function getResendClient() {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY is missing. Add it to Vercel/environment variables.');
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

export class ResendAudienceGateway {
  constructor(private readonly resend = getResendClient()) {}

  async syncExplicitSubscribe(email: string): Promise<ProviderSyncStatus> {
    const audienceId = process.env.RESEND_AUDIENCE_ID;
    if (!audienceId) return 'NOT_CONFIGURED';

    try {
      const existing = await this.resend.contacts.get({ email, audienceId });
      if (existing.data?.id) {
        const updated = await this.resend.contacts.update({ email, audienceId, unsubscribed: false });
        if (updated.error) throw new Error('Resend contact update failed');
        return 'SYNCED';
      }

      const created = await this.resend.contacts.create({ email, audienceId, unsubscribed: false });
      if (created.error) throw new Error('Resend contact create failed');
      return 'SYNCED';
    } catch (error) {
      try {
        const created = await this.resend.contacts.create({ email, audienceId, unsubscribed: false });
        if (!created.error) return 'SYNCED';
        const updated = await this.resend.contacts.update({ email, audienceId, unsubscribed: false });
        if (!updated.error) return 'SYNCED';
      } catch (_) {
        // Fall through to controlled warning below.
      }
      logger.warn('[ResendAudienceGateway] explicit subscribe sync failed', {
        operation: 'explicit_subscribe',
        email: maskEmailForLog(email),
        status: 'FAILED',
      });
      return 'FAILED';
    }
  }

  async syncExplicitUnsubscribe(email: string): Promise<ProviderSyncStatus> {
    const audienceId = process.env.RESEND_AUDIENCE_ID;
    if (!audienceId) return 'NOT_CONFIGURED';

    try {
      const updated = await this.resend.contacts.update({ email, audienceId, unsubscribed: true });
      if (updated.error) {
        if (isMissingContactError(updated.error)) return 'SYNCED';
        throw new Error('Resend contact unsubscribe failed');
      }
      return 'SYNCED';
    } catch (error) {
      if (isMissingContactError(error)) return 'SYNCED';
      logger.warn('[ResendAudienceGateway] explicit unsubscribe sync failed', {
        operation: 'explicit_unsubscribe',
        email: maskEmailForLog(email),
        status: 'FAILED',
      });
      return 'FAILED';
    }
  }
}
