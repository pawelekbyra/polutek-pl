import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getBlobAccess } from '@/lib/blob-config';

describe('getBlobAccess', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns private by default', () => {
    delete process.env.VERCEL_BLOB_ACCESS;
    expect(getBlobAccess()).toBe('private');
  });

  it('returns private when configured', () => {
    process.env.VERCEL_BLOB_ACCESS = 'private';
    expect(getBlobAccess()).toBe('private');
  });

  it('returns public when configured', () => {
    process.env.VERCEL_BLOB_ACCESS = 'public';
    expect(getBlobAccess()).toBe('public');
  });

  it('returns private for unknown values', () => {
    process.env.VERCEL_BLOB_ACCESS = 'something-else';
    expect(getBlobAccess()).toBe('private');
  });
});
