import { describe, expect, it } from 'vitest';
import { parseJsonResponse } from '@/lib/client/api';

describe('parseJsonResponse', () => {
  it('prefers public message over machine error code', async () => {
    const response = Response.json({ success: false, error: 'RATE_LIMITED', message: 'Za dużo żądań.' }, { status: 429 });
    await expect(parseJsonResponse(response)).rejects.toThrow('Za dużo żądań.');
  });

  it('falls back to error when message is missing', async () => {
    const response = Response.json({ error: 'RATE_LIMITED' }, { status: 429 });
    await expect(parseJsonResponse(response)).rejects.toThrow('RATE_LIMITED');
  });

  it('uses a status fallback when JSON parsing fails', async () => {
    const response = new Response('not json', { status: 500 });
    await expect(parseJsonResponse(response)).rejects.toThrow('Request failed with status 500');
  });
});
