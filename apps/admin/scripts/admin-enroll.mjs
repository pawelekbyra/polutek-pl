// Enrollment of the panel administrator. The ONLY way an admin account comes to exist: run on the server
// over SSH (root of trust = SSH), never from the web. Prints a one-time link (15 min, works once) in the
// terminal; nothing is e-mailed. The owner opens it through Cloudflare Access and adds a passkey + TOTP.
//
//   docker compose --profile admin run --rm admin node apps/admin/scripts/admin-enroll.mjs --email pawel.perfect@gmail.com
//   ... --role translator --languages de,es   a translator account: only the Tłumaczenia screens, only those languages
//   ... --reset   revoke every session, passkey and TOTP of that account and print a fresh link
//
// Plain ESM (no TypeScript) so it runs inside the standalone image with only @prisma/client.
// Runbook: docs/operations/ADMIN-PANEL.md.
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";

export const ENROLL_TTL_MS = 15 * 60 * 1000;
const ADVISORY_LOCK_KEY = 726_100_401; // same key as apps/admin/lib/auth/audit.ts

export function hashEnrollmentToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export function newEnrollmentToken() {
  return randomBytes(32).toString("base64url");
}

/** Must stay byte-identical to canonicalEventString/chainHash in apps/admin/lib/auth/audit.ts (tested). */
export function canonicalEventString(row) {
  return JSON.stringify([
    row.action,
    row.outcome,
    row.adminUserId,
    row.email,
    row.reason,
    row.ip,
    row.country,
    row.userAgent,
    row.requestId,
    row.createdAt.toISOString(),
  ]);
}

export function chainHash(prevHash, canonical) {
  return createHash("sha256").update(prevHash ?? "genesis").update("\n").update(canonical).digest("hex");
}

/** Languages a translator can be granted (same set as lib/modules/translations/domain/languages.ts). */
export const GRANTABLE_LANGUAGES = ["en", "de", "es", "fr", "it", "pt", "zh"];

export function parseArgs(argv) {
  const out = { email: null, name: null, reset: false, help: false, role: null, languages: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--reset") out.reset = true;
    else if (a === "--help" || a === "-h") out.help = true;
    else if (a === "--email") out.email = argv[++i] ?? null;
    else if (a.startsWith("--email=")) out.email = a.slice(8);
    else if (a === "--name") out.name = argv[++i] ?? null;
    else if (a.startsWith("--name=")) out.name = a.slice(7);
    else if (a === "--role") out.role = (argv[++i] ?? "").toUpperCase();
    else if (a.startsWith("--role=")) out.role = a.slice(7).toUpperCase();
    else if (a === "--languages") out.languages = (argv[++i] ?? "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
    else if (a.startsWith("--languages=")) out.languages = a.slice(12).split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
    else throw new Error(`Nieznany argument: ${a}`);
  }
  if (out.email) out.email = out.email.trim().toLowerCase();
  if (!out.help && (!out.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out.email))) {
    throw new Error("Podaj poprawny adres: --email <adres>");
  }
  if (out.role !== null && out.role !== "OWNER" && out.role !== "TRANSLATOR") throw new Error("--role: owner albo translator");
  if (out.role === "TRANSLATOR") {
    if (!out.languages.length) throw new Error("Tłumacz potrzebuje języków: --languages de,es");
    const bad = out.languages.filter((l) => !GRANTABLE_LANGUAGES.includes(l));
    if (bad.length) throw new Error(`Nieznane języki: ${bad.join(", ")} (dozwolone: ${GRANTABLE_LANGUAGES.join(", ")})`);
  } else if (out.languages.length) {
    throw new Error("--languages ma sens tylko z --role translator");
  }
  return out;
}

async function appendEvent(tx, row) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(${ADVISORY_LOCK_KEY})::text`;
  const last = await tx.adminAuthEvent.findFirst({ orderBy: { seq: "desc" }, select: { hash: true } });
  const prevHash = last?.hash ?? null;
  await tx.adminAuthEvent.create({ data: { ...row, prevHash, hash: chainHash(prevHash, canonicalEventString(row)) } });
}

/**
 * Creates the admin account if needed and a fresh one-time link. With `reset`, every way into the
 * account (sessions, passkeys, TOTP, password rows) is removed first, so a lost or stolen device is cut off.
 * Returns the plain token (shown once, only its hash is stored).
 *
 * @param {object} prisma PrismaClient (or a transaction-capable stand-in in tests)
 * @param {{ email: string, name?: string | null, reset?: boolean, now?: Date }} options
 */
export async function issueEnrollment(prisma, { email, name, reset, role = null, languages = [], now = new Date() }) {
  const token = newEnrollmentToken();
  const tokenHash = hashEnrollmentToken(token);
  const expiresAt = new Date(now.getTime() + ENROLL_TTL_MS);

  const result = await prisma.$transaction(async (tx) => {
    let user = await tx.adminUser.findUnique({ where: { email } });
    if (user && user.enrolledAt && !reset) {
      throw new Error("To konto ma już ukończoną rejestrację. Żeby wydać nowy link, użyj --reset (odetnie wszystkie urządzenia).");
    }
    if (!user) {
      user = await tx.adminUser.create({
        data: { id: randomUUID(), email, name: name || (role === "TRANSLATOR" ? "Tłumacz" : "Właściciel"), emailVerified: true, updatedAt: now, ...(role ? { role } : {}) },
      });
    } else if (role && user.role !== role) {
      user = await tx.adminUser.update({ where: { id: user.id }, data: { role } });
    }
    // Language grants follow the role exactly: replaced when a translator is (re)issued, dropped for an owner.
    if (role) {
      await tx.adminLanguageGrant.deleteMany({ where: { adminUserId: user.id } });
      if (role === "TRANSLATOR") await tx.adminLanguageGrant.createMany({ data: languages.map((language) => ({ adminUserId: user.id, language })) });
    }
    // An unfinished enrollment is never trusted: whatever a previous link managed to register is dropped.
    if (reset || !user.enrolledAt) {
      await tx.adminSession.deleteMany({ where: { userId: user.id } });
      await tx.adminPasskey.deleteMany({ where: { userId: user.id } });
      await tx.adminTwoFactor.deleteMany({ where: { userId: user.id } });
      await tx.adminAccount.deleteMany({ where: { userId: user.id } });
      user = await tx.adminUser.update({ where: { id: user.id }, data: { enrolledAt: null, twoFactorEnabled: false } });
    }
    // An older unused link must stop working the moment a new one is printed.
    await tx.adminEnrollment.deleteMany({ where: { userId: user.id, usedAt: null } });
    await tx.adminEnrollment.create({ data: { userId: user.id, tokenHash, expiresAt } });
    await appendEvent(tx, {
      action: reset ? "ADMIN_ENROLL_RESET" : "ADMIN_ENROLL_ISSUED",
      outcome: "success",
      adminUserId: user.id,
      email,
      reason: "cli",
      ip: null,
      country: null,
      userAgent: "admin-enroll",
      requestId: null,
      createdAt: now,
    });
    return user;
  });

  return { token, expiresAt, userId: result.id };
}

function enrollmentUrl(token) {
  const base = (process.env.ADMIN_APP_URL || "https://admin.pawelperfect.com").replace(/\/+$/, "");
  // Token in the fragment: browsers never send it to a server, proxy or log, and it never lands in Referer.
  return `${base}/rejestracja#t=${token}`;
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(String(error.message || error));
    process.exit(2);
  }
  if (args.help) {
    console.log("Użycie: admin-enroll.mjs --email <adres> [--name <imię>] [--reset] [--role translator --languages de,es]");
    return;
  }
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const { token, expiresAt } = await issueEnrollment(prisma, args);
    const until = expiresAt.toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" });
    console.log("");
    console.log(args.reset ? "Konto zresetowane: wszystkie sesje, klucze dostępu i TOTP usunięte." : "Konto administratora gotowe.");
    console.log(`Link jednorazowy (ważny do ${until}, działa raz):`);
    console.log("");
    console.log(`  ${enrollmentUrl(token)}`);
    console.log("");
    console.log("Otwórz go w przeglądarce (przejdziesz przez Cloudflare Access), dodaj klucz dostępu i TOTP.");
    console.log("Nie wklejaj linku do czatu ani maila.");
  } catch (error) {
    console.error(String(error.message || error));
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
