/**
 * Wykonawca działań operatora w kodzie aplikacji. NIE uruchamiaj ręcznie: wysyła go lib.mjs (runAppOperation)
 * na stdin jednorazowego kontenera na serwerze (obraz workera, env usługi `app`, sieć compose):
 *   tsx /tmp/ops/runner.ts <parametry base64url>
 *
 * Operacje:
 *   comment.inspect / payment.inspect   tylko odczyt, w transakcji READ ONLY (Postgres odrzuci każdy zapis);
 *                                       payment.inspect czyta też listę zwrotów ze Stripe (GET)
 *   comment.hide / comment.restore      istniejące use case'y hideAdminComment / restoreAdminComment
 *   payment.refund                      istniejący use case adminRefund (Stripe + baza + audyt PAYMENT_REFUNDED)
 *
 * Aktor: konto administratora właściciela (jedyne aktywne konto ADMIN albo --admin=<id>). Każde wykonanie zapisuje
 * dodatkowo zdarzenie audytu OPERATOR_ACTION z opisem „operator (Claude Code) na polecenie właściciela”, powodem i
 * id operacji; to samo id operacji trafia jako requestId do zdarzenia zapisanego przez use case, więc oba wiersze
 * AuditLog łączy jedno requestId. Wynik: jedna linia `@@ops-result {json}` na stdout.
 */
import { createAppContext, type AppContext } from "@/lib/modules/shared/app-context";
import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/lib/modules/audit";
import { CommentPolicy, hideAdminComment, restoreAdminComment } from "@/lib/modules/comments";
import { adminRefund, getStripeClient } from "@/lib/modules/payments";
import type { CommentStatus, Prisma } from "@prisma/client";

const MARKER = "@@ops-result ";
const OPERATOR_LABEL = "operator (Claude Code) na polecenie właściciela";
const REFUNDABLE = ["SUCCEEDED", "PARTIALLY_REFUNDED", "DISPUTED"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Params = {
  op: string;
  opId?: string;
  commentId?: string;
  paymentId?: string;
  amountMinor?: number;
  currency?: string;
  reason?: string;
  expectRefundedMinor?: number;
  adminUserId?: string | null;
};

type Tx = Prisma.TransactionClient;

/** Odrzucenie przed jakimkolwiek zapisem: wynik ma executed:false (nic się nie stało). */
class Rejected extends Error {}

function emit(result: Record<string, unknown>): void {
  process.stdout.write(`\n${MARKER}${JSON.stringify(result)}\n`);
}

function cut(text: string | null | undefined, max: number): string | null {
  if (text == null) return null;
  return text.length > max ? text.slice(0, max) : text;
}

function requireUuid(value: unknown, name: string): string {
  if (typeof value !== "string" || !UUID_RE.test(value)) throw new Rejected(`niepoprawny parametr ${name}`);
  return value;
}

/** Id użytkownika (stare konta mają id z poprzedniego dostawcy tożsamości, nowe z Better Auth, nie UUID). */
function requireUserId(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{8,64}$/.test(value)) throw new Rejected("niepoprawny parametr adminUserId");
  return value;
}

/** Odczyt w transakcji tylko do odczytu: Postgres odrzuci każdy zapis w tym bloku. */
async function readOnly<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
    return fn(tx);
  }, { timeout: 20000 });
}

async function resolveAdmin(db: Tx | typeof prisma, adminUserId: string | null | undefined) {
  if (adminUserId) {
    const user = await db.user.findFirst({ where: { id: requireUserId(adminUserId), role: "ADMIN", isDeleted: false }, select: { id: true, name: true } });
    if (!user) return { ok: false as const, error: "Podane --admin nie jest aktywnym kontem administratora." };
    return { ok: true as const, admin: user };
  }
  const admins = await db.user.findMany({ where: { role: "ADMIN", isDeleted: false }, select: { id: true, name: true }, take: 10, orderBy: { createdAt: "asc" } });
  if (admins.length === 1) return { ok: true as const, admin: admins[0] };
  return {
    ok: false as const,
    error: admins.length === 0 ? "Brak aktywnego konta administratora." : "Jest kilka kont administratora: podaj --admin=<id> konta właściciela.",
    candidates: admins.map((a) => ({ id: a.id, name: cut(a.name, 60) })),
  };
}

function operatorContext(adminId: string, opId: string): AppContext {
  return createAppContext({ actor: { type: "admin", userId: adminId }, requestId: opId });
}

async function auditOperator(ctx: AppContext, input: { targetType: string; targetId: string; metadata: Record<string, unknown> }) {
  try {
    await recordAuditEvent(ctx, {
      action: "OPERATOR_ACTION",
      targetType: input.targetType,
      targetId: input.targetId,
      userAgent: "ops-actions (Claude Code)",
      metadata: { operator: "Claude Code", onBehalfOf: "owner", label: OPERATOR_LABEL, ...input.metadata } as Prisma.InputJsonValue,
    });
    return true;
  } catch {
    return false;
  }
}

// ------------------------------------------------------------------ komentarze

async function loadComment(db: Tx | typeof prisma, commentId: string) {
  const c = await db.comment.findUnique({
    where: { id: commentId },
    select: {
      id: true, status: true, text: true, createdAt: true, parentId: true, reportsCount: true,
      author: { select: { name: true, role: true } },
      video: { select: { slug: true, title: true } },
      _count: { select: { reports: { where: { status: "PENDING" } } } },
    },
  });
  if (!c) return null;
  return {
    id: c.id,
    status: c.status,
    text: cut(c.text, 1500),
    createdAt: c.createdAt.toISOString(),
    isReply: c.parentId !== null,
    reportsCount: c.reportsCount,
    pendingReports: c._count.reports,
    authorName: cut(c.author?.name ?? null, 120),
    authorIsAdmin: c.author?.role === "ADMIN",
    videoSlug: c.video?.slug ?? null,
    videoTitle: cut(c.video?.title ?? null, 200),
  };
}

async function commentInspect(p: Params) {
  const commentId = requireUuid(p.commentId, "commentId");
  return readOnly(async (tx) => {
    const comment = await loadComment(tx, commentId);
    const admin = await resolveAdmin(tx, p.adminUserId);
    const status = comment?.status as CommentStatus | undefined;
    return {
      ok: true,
      comment,
      policyAllows: status ? { hide: CommentPolicy.canTransition("hide", status), restore: CommentPolicy.canTransition("restore", status) } : null,
      admin: admin.ok ? { id: admin.admin.id, name: cut(admin.admin.name, 60) } : null,
      adminError: admin.ok ? null : admin.error,
      adminCandidates: admin.ok ? null : admin.candidates ?? null,
    };
  });
}

async function commentModerate(p: Params, action: "hide" | "restore") {
  const commentId = requireUuid(p.commentId, "commentId");
  const opId = String(p.opId ?? "");
  const reason = String(p.reason ?? "").slice(0, 300);
  if (!/^ops-[0-9a-f-]{36}$/.test(opId) || reason.length < 3) throw new Rejected("brak opId albo powodu");
  const admin = await resolveAdmin(prisma, p.adminUserId);
  if (!admin.ok) return { ok: false, executed: false, error: admin.error, adminCandidates: admin.candidates ?? null };
  const before = await loadComment(prisma, commentId);
  if (!before) return { ok: false, executed: false, error: "Komentarz nie istnieje." };

  const ctx = operatorContext(admin.admin.id, opId);
  const result = action === "hide" ? await hideAdminComment(commentId, ctx) : await restoreAdminComment(commentId, ctx);
  const after = await prisma.comment.findUnique({ where: { id: commentId }, select: { status: true } });
  const code = result.ok ? (before.status === after?.status ? "NOOP" : "OK") : result.error.type;
  const audited = await auditOperator(ctx, {
    targetType: "COMMENT",
    targetId: commentId,
    metadata: { operation: `comment.${action}`, opId, reason, from: before.status, to: after?.status ?? null, outcome: code },
  });
  return {
    ok: result.ok,
    executed: true,
    outcome: { code, from: before.status, to: after?.status ?? null, message: result.ok ? null : result.error.message, auditOperatorAction: audited },
    admin: { id: admin.admin.id },
  };
}

// ------------------------------------------------------------------ płatności

async function loadPayment(db: Tx | typeof prisma, paymentId: string) {
  const pay = await db.payment.findUnique({
    where: { id: paymentId },
    select: {
      id: true, status: true, amountMinor: true, refundedAmountMinor: true, currency: true, createdAt: true,
      refundedAt: true, refundReason: true, stripeIntentId: true, user: { select: { name: true } },
    },
  });
  if (!pay) return null;
  return {
    id: pay.id,
    status: pay.status,
    amountMinor: pay.amountMinor,
    refundedAmountMinor: pay.refundedAmountMinor,
    currency: pay.currency,
    createdAt: pay.createdAt.toISOString(),
    refundedAt: pay.refundedAt?.toISOString() ?? null,
    refundReason: cut(pay.refundReason, 300),
    hasStripeIntent: Boolean(pay.stripeIntentId),
    payerName: cut(pay.user?.name ?? null, 120),
    stripeIntentId: pay.stripeIntentId,
  };
}

async function stripeRefunds(intentId: string | null) {
  if (!intentId) return { ok: true, refunds: [] };
  try {
    const list = await getStripeClient().refunds.list({ payment_intent: intentId, limit: 20 });
    return {
      ok: true,
      refunds: list.data.map((r) => ({ id: r.id, amountMinor: r.amount, currency: r.currency.toUpperCase(), status: r.status, created: new Date(r.created * 1000).toISOString() })),
    };
  } catch (error) {
    return { ok: false, error: `Stripe: ${String((error as Error)?.message ?? error).slice(0, 200)}`, refunds: [] };
  }
}

/** Płatność bez id PaymentIntent (nie jest potrzebne na komputerze właściciela). */
function publicPayment(pay: NonNullable<Awaited<ReturnType<typeof loadPayment>>>) {
  return Object.fromEntries(Object.entries(pay).filter(([key]) => key !== "stripeIntentId"));
}

async function paymentInspect(p: Params) {
  const paymentId = requireUuid(p.paymentId, "paymentId");
  const { payment, admin } = await readOnly(async (tx) => ({ payment: await loadPayment(tx, paymentId), admin: await resolveAdmin(tx, p.adminUserId) }));
  const stripe = payment ? await stripeRefunds(payment.stripeIntentId) : { ok: true, refunds: [] };
  return {
    ok: true,
    payment: payment ? publicPayment(payment) : null,
    stripeRefunds: stripe,
    admin: admin.ok ? { id: admin.admin.id, name: cut(admin.admin.name, 60) } : null,
    adminError: admin.ok ? null : admin.error,
    adminCandidates: admin.ok ? null : admin.candidates ?? null,
  };
}

async function paymentRefund(p: Params) {
  const paymentId = requireUuid(p.paymentId, "paymentId");
  const opId = String(p.opId ?? "");
  const reason = String(p.reason ?? "").slice(0, 300);
  const amountMinor = Number(p.amountMinor);
  const currency = String(p.currency ?? "").toUpperCase();
  if (!/^ops-[0-9a-f-]{36}$/.test(opId) || reason.length < 3) throw new Rejected("brak opId albo powodu");
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) throw new Rejected("niepoprawna kwota");
  if (!Number.isInteger(p.expectRefundedMinor)) throw new Rejected("brak expectRefundedMinor");

  const admin = await resolveAdmin(prisma, p.adminUserId);
  if (!admin.ok) return { ok: false, executed: false, error: admin.error, adminCandidates: admin.candidates ?? null };
  const pay = await loadPayment(prisma, paymentId);
  if (!pay) return { ok: false, executed: false, error: "Płatność nie istnieje." };

  // Twarde warunki jeszcze raz, tuż przed zleceniem zwrotu (stan mógł się zmienić po podglądzie). adminRefund
  // dodatkowo pilnuje statusu i maksymalnej kwoty; Stripe dostaje klucz idempotencji.
  const remaining = pay.amountMinor - pay.refundedAmountMinor;
  const problems: string[] = [];
  if (pay.currency.toUpperCase() !== currency) problems.push(`waluta płatności ${pay.currency}, podano ${currency}`);
  if (pay.refundedAmountMinor !== p.expectRefundedMinor) problems.push(`zwrócono już ${pay.refundedAmountMinor}, podgląd pokazywał ${p.expectRefundedMinor}`);
  if (amountMinor > remaining) problems.push(`kwota ${amountMinor} > pozostała ${remaining}`);
  if (!REFUNDABLE.includes(pay.status)) problems.push(`status ${pay.status}`);
  if (problems.length) return { ok: false, executed: false, error: `Zwrot wstrzymany: ${problems.join("; ")}.`, payment: publicPayment(pay) };

  const ctx = operatorContext(admin.admin.id, opId);
  let result: Awaited<ReturnType<typeof adminRefund>>;
  try {
    result = await adminRefund({ paymentId, amountMinor, reason: `${reason} [${OPERATOR_LABEL}, ${opId}]` }, ctx);
  } catch (error) {
    await auditOperator(ctx, { targetType: "Payment", targetId: paymentId, metadata: { operation: "payment.refund", opId, reason, amountMinor, currency, outcome: "EXCEPTION" } });
    throw error;
  }
  const after = await loadPayment(prisma, paymentId);
  const code = result.ok ? "OK" : result.error.code ?? "ERROR";
  const audited = await auditOperator(ctx, {
    targetType: "Payment",
    targetId: paymentId,
    metadata: {
      operation: "payment.refund", opId, reason, amountMinor, currency, outcome: code,
      stripeRefundId: result.ok ? result.data.stripeRefundId : null,
      refundedBeforeMinor: pay.refundedAmountMinor,
      refundedAfterMinor: after?.refundedAmountMinor ?? null,
    },
  });
  return {
    ok: result.ok,
    executed: true,
    outcome: {
      code,
      message: result.ok ? null : result.error.message,
      stripeRefundId: result.ok ? result.data.stripeRefundId : null,
      stripeStatus: result.ok ? result.data.status : null,
      amountMinor,
      currency,
      statusBefore: pay.status,
      statusAfter: after?.status ?? null,
      refundedAfterMinor: after?.refundedAmountMinor ?? null,
      auditOperatorAction: audited,
    },
    admin: { id: admin.admin.id },
  };
}

// ------------------------------------------------------------------ main

const OPS: Record<string, (p: Params) => Promise<Record<string, unknown>>> = {
  "comment.inspect": commentInspect,
  "comment.hide": (p) => commentModerate(p, "hide"),
  "comment.restore": (p) => commentModerate(p, "restore"),
  "payment.inspect": paymentInspect,
  "payment.refund": paymentRefund,
};

async function main() {
  let params: Params;
  try {
    params = JSON.parse(Buffer.from(String(process.argv[2] ?? ""), "base64url").toString("utf8")) as Params;
  } catch {
    emit({ ok: false, error: "nieczytelne parametry" });
    return;
  }
  const fn = OPS[params.op];
  if (!fn) {
    emit({ ok: false, error: `nieznana operacja ${String(params.op).slice(0, 40)}` });
    return;
  }
  try {
    emit(await fn(params));
  } catch (error) {
    // Rejected = nic nie zapisano. Inny wyjątek w operacji zapisu: wynik nieznany (brak pola executed).
    const message = String((error as Error)?.message ?? error).slice(0, 300);
    emit(error instanceof Rejected ? { ok: false, executed: false, error: message } : { ok: false, error: message });
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}

void main();
