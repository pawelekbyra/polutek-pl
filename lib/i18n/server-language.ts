import { cookies, headers } from "next/headers";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export type AppLanguage = "pl" | "en";

export const LANGUAGE_COOKIE = "app-language";

function isLanguage(value: string | null | undefined): value is AppLanguage {
  return value === "pl" || value === "en";
}

/**
 * Resolves the initial UI language on the server so the first paint already matches the viewer's
 * preference (no flash, no hydration mismatch). Priority, highest first:
 *
 *   1. Signed-in user's stored preference (`User.language`) — authoritative once logged in.
 *   2. Explicit browser choice persisted in the `app-language` cookie (set by the language toggle).
 *   3. Geolocation via the Vercel edge country header (`x-vercel-ip-country`): PL → Polish.
 *   4. The browser's `Accept-Language` header.
 *   5. Default: English.
 *
 * The cookie mirror (2) is what lets a logged-out choice survive reloads, and it is also written
 * client-side alongside localStorage so this server read stays consistent with the client.
 */
export async function resolveInitialLanguage(): Promise<AppLanguage> {
  // 1. Logged-in preference from the database.
  try {
    const { userId } = await auth();
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { language: true },
      });
      if (isLanguage(user?.language)) return user!.language as AppLanguage;
    }
  } catch (error) {
    logger.warn("[resolveInitialLanguage] auth/db lookup failed, falling back", error);
  }

  // 2. Explicit browser choice.
  const cookieStore = await cookies();
  const cookieLang = cookieStore.get(LANGUAGE_COOKIE)?.value;
  if (isLanguage(cookieLang)) return cookieLang;

  const headerList = await headers();

  // 3. Geolocation (best effort, Vercel-provided).
  const country = headerList.get("x-vercel-ip-country");
  if (country && country.toUpperCase() === "PL") return "pl";

  // 4. Browser language preference.
  const acceptLanguage = headerList.get("accept-language") ?? "";
  if (/(^|[,\s])pl\b/i.test(acceptLanguage)) return "pl";

  // 5. Default.
  return "en";
}
