import { describe, it, expect, vi } from 'vitest';
import { POST as webhookPost } from '@/app/api/webhooks/stripe/route';
import { NextRequest } from 'next/server';

// Characterization tests for R7 legacy flows to be migrated
describe('R7 Legacy Inventory Characterization', () => {
  it('Stripe webhook route requires signature', async () => {
    const req = new NextRequest('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    // Missing stripe-signature header

    const res = await webhookPost(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('stripe-signature');
  });
});
