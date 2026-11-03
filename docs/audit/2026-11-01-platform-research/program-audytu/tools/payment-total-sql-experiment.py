"""Two refund/dispute delivery protocols on the existing LOCAL research DB.

Not TypeScript/Prisma/Stripe execution: checks actual Payment/UserPaymentTotal SQL
with the protocol inspected in handle-dispute/handle-refund/payment.repository.
Own random fixture rows are always rolled back. No schema or production changes.
"""
import csv
import hashlib
import importlib.util
import json
from pathlib import Path
import uuid

ROOT = Path.cwd()
BASE = ROOT / 'docs/audit/2026-11-01-platform-research/program-audytu'
spec = importlib.util.spec_from_file_location('local_psql', BASE / 'tools/database-integrity-experiment.py')
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)


def main():
    inventory = {r['path']: r['sha256'] for r in csv.DictReader((BASE / 'INWENTARZ-PLIKOW.csv').open())}
    paths = ['prisma/schema.prisma', 'lib/modules/payments/application/handle-dispute.use-case.ts',
             'lib/modules/payments/application/handle-refund.use-case.ts',
             'lib/modules/payments/infrastructure/payment.repository.ts']
    for file in paths:
        assert hashlib.sha256((ROOT / file).read_bytes()).hexdigest() == inventory[file], file
    session = helper.Session()
    observations = []
    try:
        metadata = json.loads(session.one("SELECT json_build_object('database',current_database(),'server_version',current_setting('server_version'),'transaction_isolation',current_setting('transaction_isolation'))"))
        assert metadata['database'] == helper.DATABASE
        for late in [False, True]:
            prefix = 'audit-payment-' + uuid.uuid4().hex[:12]
            q = helper.q
            user, payment = prefix + '-u', prefix + '-a'
            try:
                session.query("BEGIN; SET LOCAL statement_timeout='10s'; SET LOCAL lock_timeout='3s';" + helper.user_sql(prefix) + f'''
                  INSERT INTO "Payment" ("id","userId","amountMinor","currency","status","updatedAt") VALUES
                    ({q(payment)},{q(user)},1000,'PLN','SUCCEEDED',now()),
                    ({q(prefix+'-b')},{q(user)},500,'PLN','SUCCEEDED',now());
                  INSERT INTO "UserPaymentTotal" ("id","userId","currency","amountMinor")
                    VALUES ({q(prefix+'-total')},{q(user)},'PLN',1500);
                ''')

                def refund():
                    # Actual inspected positive delta branch: status preserved for CHARGEBACK_LOST,
                    # refunded amount CAS, followed by unconditional positive delta decrement.
                    session.query(f'''
                      UPDATE "Payment" SET "refundedAmountMinor"=400,
                        "status"=CASE WHEN "status"='CHARGEBACK_LOST' THEN 'CHARGEBACK_LOST'::"PaymentStatus" ELSE 'PARTIALLY_REFUNDED'::"PaymentStatus" END
                        WHERE "id"={q(payment)} AND "refundedAmountMinor"=0;
                      UPDATE "UserPaymentTotal" SET "amountMinor"=GREATEST(0,"amountMinor"-400)
                        WHERE "userId"={q(user)} AND "currency"='PLN';
                    ''')

                def lose():
                    adjustment = int(session.one(f'''SELECT GREATEST(0,"amountMinor"-"refundedAmountMinor") FROM "Payment" WHERE "id"={q(payment)}'''))
                    session.query(f'''
                      UPDATE "Payment" SET "status"='CHARGEBACK_LOST' WHERE "id"={q(payment)} AND "status" IN ('SUCCEEDED','PARTIALLY_REFUNDED');
                      UPDATE "UserPaymentTotal" SET "amountMinor"=GREATEST(0,"amountMinor"-{adjustment})
                        WHERE "userId"={q(user)} AND "currency"='PLN';
                    ''')

                if late:
                    lose()
                    refund()
                else:
                    refund()
                    lose()
                state = json.loads(session.one(f'''SELECT json_build_object(
                  'payment_status',(SELECT "status" FROM "Payment" WHERE "id"={q(payment)}),
                  'refunded_minor',(SELECT "refundedAmountMinor" FROM "Payment" WHERE "id"={q(payment)}),
                  'other_payment_minor',(SELECT "amountMinor" FROM "Payment" WHERE "id"={q(prefix+'-b')} AND "status"='SUCCEEDED'),
                  'actual_total_minor',(SELECT "amountMinor" FROM "UserPaymentTotal" WHERE "userId"={q(user)} AND "currency"='PLN'))'''))
                assert state['payment_status'] == 'CHARGEBACK_LOST' and state['refunded_minor'] == 400
                assert state['other_payment_minor'] == 500 and state['actual_total_minor'] == (100 if late else 500)
                observations.append({'name': 'late_refund_after_lost_dispute' if late else 'refund_before_lost_dispute_control',
                                     'finding': 'R32' if late else None, 'expected_total_minor': 500, **state})
            finally:
                session.query('ROLLBACK')
            assert int(session.one(f'''SELECT count(*) FROM "User" WHERE "id"={q(user)}''')) == 0
        print(json.dumps({'date': '2026-11-01', 'kind': 'REAL_LOCAL_POSTGRESQL_INSPECTED_REFUND_DISPUTE_PROTOCOL',
          'database_metadata': metadata, 'application_source_sha256': {p: inventory[p] for p in paths},
          'observations': observations, 'fixtures_rolled_back': True,
          'limits': ['Actual migrated tables and GREATEST/CAS SQL; no TypeScript/Prisma/HTTP execution in this script.',
                     'No real Stripe refund/dispute lifecycle, actual webhook delivery or financial operation.',
                     'Sequential delivery histories, not a database concurrency/isolation test.',
                     'UserPaymentTotal is a per-user aggregate; this is not a demonstrated duplicate charge/refund or creator payout loss.']}, indent=2))
    finally:
        session.close()


if __name__ == '__main__':
    main()
