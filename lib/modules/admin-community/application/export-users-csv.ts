import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { AppError } from "@/lib/modules/shared/app-error";
import { recordAuditEvent } from "@/lib/modules/audit";
import { normalizePaymentTotals } from "@/lib/modules/users";
import { toCsv, type CsvCell } from "../domain/csv";
import { panelUserWhere, type PanelUserFilters } from "./panel-users";

/** A hard cap so one click can never pull the whole table into the 384 MB panel process. */
export const USERS_EXPORT_MAX_ROWS = 20_000;

const HEADER = ["ID", "E-mail", "Pseudonim", "Rola", "E-mail potwierdzony", "Znacznik wspierającego", "Napiwki (PLN, przybliżone)", "Wpłaty", "Język", "Wyciszony do", "Usunięte", "Założone"];

/**
 * CSV of the accounts the list currently shows (same search and segment). Personal data, so the caller must have
 * checked a fresh step-up; this use case writes the audit row USERS_EXPORT (actor, filters, row count) in the same
 * transaction as the read, so there is never an export without a trace. Every text cell is neutralised against
 * spreadsheet formula injection (see domain/csv.ts). Refuses more than USERS_EXPORT_MAX_ROWS rows (narrow the filter).
 */
export async function exportUsersCsv(ctx: AppContext, filters: PanelUserFilters): Promise<UseCaseResult<{ csv: string; rows: number; fileName: string }, AppError>> {
  if (ctx.actor.type !== "admin") return fail(new AppError("Brak uprawnień administratora.", 403, "FORBIDDEN"));
  const now = ctx.now();
  const where = panelUserWhere(filters, now);
  const total = await ctx.prisma.user.count({ where });
  if (total > USERS_EXPORT_MAX_ROWS) return fail(new AppError(`Za dużo wierszy (${total}). Zawęź filtry do najwyżej ${USERS_EXPORT_MAX_ROWS}.`, 413, "EXPORT_TOO_LARGE"));

  const users = await ctx.db.writeTransaction(async (tx) => {
    const rows = await tx.user.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take: USERS_EXPORT_MAX_ROWS,
      select: {
        id: true, email: true, name: true, role: true, emailVerified: true, language: true, isDeleted: true, createdAt: true, commentMutedUntil: true,
        paymentTotals: { select: { currency: true, amountMinor: true } },
        patronGrants: { where: { revokedAt: null }, select: { id: true }, take: 1 },
        _count: { select: { payments: true } },
      },
    });
    await recordAuditEvent(ctx, { action: "USERS_EXPORT", targetType: "System", metadata: { filters: { q: filters.q ?? null, seg: filters.seg ?? null }, count: rows.length } }, tx);
    return rows;
  });

  const cells = users.map((u): CsvCell[] => [
    { text: u.id },
    { text: u.isDeleted ? "" : u.email },
    { text: u.isDeleted ? "" : u.name ?? "" },
    { text: u.role },
    { text: u.emailVerified ? "tak" : "nie" },
    { text: u.patronGrants.length ? "tak" : "nie" },
    { number: Math.round(normalizePaymentTotals(u.paymentTotals) * 100) / 100 },
    { number: u._count.payments },
    { text: u.language },
    { text: u.commentMutedUntil && u.commentMutedUntil > now ? u.commentMutedUntil.toISOString() : "" },
    { text: u.isDeleted ? "tak" : "nie" },
    { text: u.createdAt.toISOString() },
  ]);
  return ok({ csv: toCsv(HEADER, cells), rows: users.length, fileName: `uzytkownicy-${now.toISOString().slice(0, 10)}.csv` });
}
