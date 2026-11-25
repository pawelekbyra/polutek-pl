import type { AppContext } from "@/lib/modules/shared/app-context";
import { readPass } from "../infrastructure/pass-store";

/** Portable fields for one account's patron-zone access grant; payment and request references stay internal. */
export async function exportOwnPassData(ctx: Pick<AppContext, "prisma">, userId: string) {
  const record = await readPass(ctx.prisma, userId);
  if (!record) return null;

  const { provider, productId, priceMinor, totalMinor, currency, method, grantedAt, expiresAt, consents } = record;
  return { provider, productId, priceMinor, totalMinor, currency, method, grantedAt, expiresAt, consents };
}
