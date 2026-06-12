import { Resend } from 'resend';
import { logger } from '@/lib/logger';
import { maskEmailForLog } from '../domain/email-address';
import { ProviderSyncStatus } from '../domain/provider-sync-status';

function isMissingContactError(error: unknown): boolean {
  const candidate = error as { statusCode?: number; status?: number; message?: string; name?: string } | null;
  const message = String(candidate?.message ?? '').toLowerCase();
  const name = String(candidate?.name ?? '').toLowerCase();
  return (
    candidate?.statusCode === 404 ||
    candidate?.status === 404 ||
    message.includes('not found') ||
    name.includes('not_found')
  );
}

function isConflictError(error: unknown): boolean {
  const candidate = error as { statusCode?: number; status?: number; message?: string; name?: string } | null;
  const message = String(candidate?.message ?? '').toLowerCase();
  const name = String(candidate?.name ?? '').toLowerCase();
  return (
    candidate?.statusCode === 409 ||
    candidate?.status === 409 ||
    message.includes('already exists') ||
    message.includes('conflict') ||
    name.includes('conflict') ||
    name.includes('already_exists')
  );
}

export interface ResendContactsClient {
  contacts: {
    get(payload: { email: string; audienceId: string }): Promise<{ data: any; error: any }>;
    create(payload: { email: string; audienceId: string; unsubscribed?: boolean }): Promise<{ data: any; error: any }>;
    update(payload: { email: string; audienceId: string; unsubscribed?: boolean }): Promise<{ data: any; error: any }>;
  };
}

export class ResendAudienceGateway {
  constructor(private readonly injectedResend?: ResendContactsClient) {}

  private getClient(): ResendContactsClient | null {
    if (this.injectedResend) return this.injectedResend;
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return null;
    return new Resend(apiKey);
  }

  async syncExplicitSubscribe(email: string): Promise<ProviderSyncStatus> {
    const audienceId = process.env.RESEND_AUDIENCE_ID;
    if (!audienceId) return 'NOT_CONFIGURED';

    const client = this.getClient();
    if (!client) {
      logger.warn('[ResendAudienceGateway] sync skipped: RESEND_API_KEY missing');
      return 'FAILED';
    }

    try {
      const getResult = await client.contacts.get({ email, audienceId });

      if (getResult.data?.id) {
        const updateResult = await client.contacts.update({ email, audienceId, unsubscribed: false });
        if (!updateResult.error) return 'SYNCED';
        throw updateResult.error;
      }

      if (getResult.error && !isMissingContactError(getResult.error)) {
        throw getResult.error;
      }

      const createResult = await client.contacts.create({ email, audienceId, unsubscribed: false });
      if (!createResult.error) return 'SYNCED';

      if (isConflictError(createResult.error)) {
        const updateRetryResult = await client.contacts.update({ email, audienceId, unsubscribed: false });
        if (!updateRetryResult.error) return 'SYNCED';
        throw updateRetryResult.error;
      }

      throw createResult.error;
    } catch (error) {
      logger.warn('[ResendAudienceGateway] explicit subscribe sync failed', {
        operation: 'explicit_subscribe',
        email: maskEmailForLog(email),
        error: error instanceof Error ? error.message : String(error),
      });
      return 'FAILED';
    }
  }

  async syncExplicitUnsubscribe(email: string): Promise<ProviderSyncStatus> {
    const audienceId = process.env.RESEND_AUDIENCE_ID;
    if (!audienceId) return 'NOT_CONFIGURED';

    const client = this.getClient();
    if (!client) {
      logger.warn('[ResendAudienceGateway] unsubscribe sync skipped: RESEND_API_KEY missing');
      return 'FAILED';
    }

    try {
      const updateResult = await client.contacts.update({ email, audienceId, unsubscribed: true });

      if (updateResult.error) {
        if (isMissingContactError(updateResult.error)) {
          return 'SYNCED';
        }
        throw updateResult.error;
      }

      return 'SYNCED';
    } catch (error) {
      if (isMissingContactError(error)) return 'SYNCED';

      logger.warn('[ResendAudienceGateway] explicit unsubscribe sync failed', {
        operation: 'explicit_unsubscribe',
        email: maskEmailForLog(email),
        error: error instanceof Error ? error.message : String(error),
      });
      return 'FAILED';
    }
  }
}
