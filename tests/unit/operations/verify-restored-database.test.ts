import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mocking process.exit to prevent the test runner from exiting
const mockExit = vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined) => {
  return undefined as never;
});

// Mocking console methods to keep test output clean
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

// Mocking @prisma/client
vi.mock('@prisma/client', () => {
  class MockPrismaClient {
    constructor() {}
    $connect = vi.fn().mockResolvedValue(undefined);
    $disconnect = vi.fn().mockResolvedValue(undefined);
    $queryRaw = vi.fn().mockImplementation((query) => {
      if (query[0].includes('SELECT NOW()')) return Promise.resolve([{ now: new Date() }]);
      if (query[0].includes('SELECT * FROM _prisma_migrations')) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    user = { count: vi.fn().mockResolvedValue(0) };
    creator = { count: vi.fn().mockResolvedValue(0) };
    video = { count: vi.fn().mockResolvedValue(0) };
    videoAsset = { count: vi.fn().mockResolvedValue(0) };
    payment = { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) };
    userPaymentTotal = { count: vi.fn().mockResolvedValue(0) };
    patronGrant = { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) };
    stripeEvent = { count: vi.fn().mockResolvedValue(0) };
    comment = { count: vi.fn().mockResolvedValue(0) };
    commentReport = { count: vi.fn().mockResolvedValue(0) };
    subscription = { count: vi.fn().mockResolvedValue(0) };
    auditLog = { count: vi.fn().mockResolvedValue(0) };
  }
  return { PrismaClient: MockPrismaClient };
});

describe('verify-restored-database script safety and logic', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    mockExit.mockClear();
    mockConsoleError.mockClear();
    mockConsoleLog.mockClear();
    mockConsoleWarn.mockClear();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should fail if RESTORE_DATABASE_URL is missing', async () => {
    process.env.RESTORE_DATABASE_URL = '';
    process.env.ALLOW_RESTORE_VERIFICATION = 'true';

    await import('../../../scripts/verify-restored-database.ts?' + Date.now());

    expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('RESTORE_DATABASE_URL is missing'));
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('should fail if ALLOW_RESTORE_VERIFICATION is not true', async () => {
    process.env.RESTORE_DATABASE_URL = 'postgresql://user:pass@host:5432/db';
    process.env.ALLOW_RESTORE_VERIFICATION = 'false';

    await import('../../../scripts/verify-restored-database.ts?' + Date.now());

    expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('ALLOW_RESTORE_VERIFICATION=true is required'));
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('should fail if RESTORE_DATABASE_URL matches DATABASE_URL', async () => {
    const url = 'postgresql://user:pass@host:5432/db';
    process.env.RESTORE_DATABASE_URL = url;
    process.env.DATABASE_URL = url;
    process.env.ALLOW_RESTORE_VERIFICATION = 'true';

    await import('../../../scripts/verify-restored-database.ts?' + Date.now());

    expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('RESTORE_DATABASE_URL exactly matches DATABASE_URL'));
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('should redact credentials in log output', async () => {
    process.env.RESTORE_DATABASE_URL = 'postgresql://secret_user:secret_pass@prod-db.example.com:5432/my_db';
    process.env.ALLOW_RESTORE_VERIFICATION = 'true';
    process.env.DATABASE_URL = 'postgresql://other@other';

    await import('../../../scripts/verify-restored-database.ts?' + Date.now());

    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Target: postgresql://secret_user:****@prod-db.example.com:5432/my_db'));
    expect(mockConsoleLog).not.toHaveBeenCalledWith(expect.stringContaining('secret_pass'));
  });
});
