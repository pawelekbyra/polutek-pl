// Run the actual CLI with a synthetic read-only DB boundary and real exit semantics.
// No installed Prisma files, production URLs or network operations are changed.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';

const sourcePath = process.argv[2];
const scenario = process.argv[3] || 'success';
const models = {
  user: 'User', creator: 'Creator', video: 'Video', videoAsset: 'VideoAsset',
  payment: 'Payment', userPaymentTotal: 'UserPaymentTotal', patronGrant: 'PatronGrant',
  stripeEvent: 'StripeEvent', comment: 'Comment', commentReport: 'CommentReport',
  subscription: 'Subscription', auditLog: 'AuditLog',
};

class FixturePrismaClient {
  constructor() {
    console.log('FIXTURE_CLIENT_CREATED');
    for (const [property, label] of Object.entries(models)) {
      this[property] = {
        count: async () => {
          if (scenario === `count:${label}`) throw new Error(`synthetic ${label} count failure`);
          return 1;
        },
        findMany: async () => [],
      };
    }
    if (scenario === 'orphan-user') this.patronGrant.findMany = async (args) => args.select.userId ? [{ userId: 'missing-user' }] : [];
    if (scenario === 'orphan-payment') this.patronGrant.findMany = async (args) => args.select.paymentId ? [{ paymentId: 'missing-payment' }] : [];
    if (scenario === 'orphan-video') this.videoAsset.findMany = async () => [{ videoId: 'missing-video' }];
  }
  async $connect() {
    if (scenario === 'connection-failure') throw new Error('synthetic connection failure');
  }
  async $disconnect() { console.log('FIXTURE_DISCONNECTED'); }
  async $queryRaw(query) {
    const sql = query.join('');
    if (sql.includes('SELECT NOW()')) return [{ now: new Date('2026-11-02T00:00:00Z') }];
    if (!sql.includes('SELECT * FROM _prisma_migrations')) throw new Error('Unexpected query');
    if (scenario === 'migration-read-failure') throw new Error('synthetic migration metadata failure');
    if (scenario === 'migration-unfinished') return [{ finished_at: null, rolled_back_at: null, logs: null }];
    if (scenario === 'migration-failed') return [{ finished_at: null, rolled_back_at: null, logs: 'synthetic failure' }];
    const completed = { finished_at: new Date('2026-11-01T00:00:00Z'), rolled_back_at: null, logs: null };
    if (scenario === 'migration-rolled-back') return [completed, { finished_at: null, rolled_back_at: new Date('2026-11-01T00:00:00Z'), logs: 'previous failure' }];
    return [completed];
  }
}

const compiled = ts.transpileModule(fs.readFileSync(sourcePath, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const realRequire = createRequire(sourcePath);
const boundaryRequire = (id) => id === '@prisma/client' ? { PrismaClient: FixturePrismaClient } : realRequire(id);
const loaded = { exports: {} };
const execute = new vm.Script(`(function(require, module, exports, __filename, __dirname) {\n${compiled}\n})`, { filename: sourcePath }).runInThisContext();
execute(boundaryRequire, loaded, loaded.exports, sourcePath, path.dirname(sourcePath));
