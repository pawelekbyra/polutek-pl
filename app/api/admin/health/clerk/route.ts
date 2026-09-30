import { NextRequest, NextResponse } from "next/server";
import { requireAdminForApi } from "@/lib/auth-utils";
import { generateCSP } from "@/lib/utils/security";
import { isHealthTokenAuthorized } from "@/lib/api/health-token";

export const dynamic = "force-dynamic";

const HEALTH_SCOPE = "GET_ADMIN_CLERK_HEALTH";

function getMissingClerkEnv() {
  return [
    !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" : null,
    !process.env.CLERK_SECRET_KEY ? "CLERK_SECRET_KEY" : null,
    !process.env.CLERK_WEBHOOK_SECRET ? "CLERK_WEBHOOK_SECRET" : null,
    !process.env.ADMIN_CLERK_USER_IDS ? "ADMIN_CLERK_USER_IDS" : null,
  ].filter(Boolean) as string[];
}

type DecodedPublishableKey = {
  instanceType: "live" | "test" | "unknown";
  frontendApiHost: string | null;
  decodeError: string | null;
};

// Clerk publishable keys are `pk_(live|test)_` + base64("{frontendApiHost}$").
// The Frontend API host is baked into the key itself, so a stale key from
// before a Clerk custom-domain change will keep pointing at the old host no
// matter what's configured in the Clerk dashboard.
function decodePublishableKey(publishableKey: string): DecodedPublishableKey {
  const match = publishableKey.match(/^pk_(live|test)_([A-Za-z0-9+/=]+)$/);
  if (!match) {
    return { instanceType: "unknown", frontendApiHost: null, decodeError: "Key does not match the expected pk_live_/pk_test_ format." };
  }

  const [, type, encoded] = match;
  const instanceType = type as "live" | "test";

  try {
    const decoded = Buffer.from(encoded, "base64").toString("utf-8");
    const host = decoded.endsWith("$") ? decoded.slice(0, -1) : decoded;
    if (!host) {
      return { instanceType, frontendApiHost: null, decodeError: "Decoded key payload was empty." };
    }
    return { instanceType, frontendApiHost: host, decodeError: null };
  } catch {
    return { instanceType, frontendApiHost: null, decodeError: "Failed to base64-decode key payload." };
  }
}

function baseDomain(host: string) {
  const parts = host.split(".");
  return parts.length <= 2 ? host : parts.slice(-2).join(".");
}

function isHostAllowedByCsp(host: string) {
  const csp = generateCSP();
  const exact = `https://${host}`;
  if (csp.includes(`${exact} `) || csp.includes(`${exact};`) || csp.endsWith(exact)) return true;

  const labels = host.split(".");
  for (let i = 1; i < labels.length - 1; i++) {
    const wildcard = `https://*.${labels.slice(i).join(".")}`;
    if (csp.includes(wildcard)) return true;
  }
  return false;
}

async function probeFrontendApiHost(host: string) {
  try {
    const response = await fetch(`https://${host}/npm/@clerk/clerk-js@5/dist/clerk.browser.js`, {
      method: "HEAD",
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    return { reachable: true, status: response.status, error: null };
  } catch (error) {
    return {
      reachable: false,
      status: null,
      error: error instanceof Error ? error.message : "Unknown network error",
    };
  }
}

function getRuntimeDiagnostics() {
  return {
    nodeEnv: process.env.NODE_ENV || null,
    vercelEnv: process.env.VERCEL_ENV || null,
    appUrl: process.env.NEXT_PUBLIC_APP_URL || null,
    gitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA || null,
    gitCommitRef: process.env.VERCEL_GIT_COMMIT_REF || null,
  };
}

function isAuthorizedByHealthToken(request: NextRequest) {
  // Header-only (x-health-token): a query-param token would end up in logs.
  return isHealthTokenAuthorized(request);
}

export async function GET(request: NextRequest) {
  // Clerk being broken is exactly the failure mode this endpoint exists to
  // diagnose, so it can't require a working Clerk admin session as its only
  // way in. HEALTHCHECK_TOKEN (already required in production, read from the
  // Vercel dashboard directly, no Clerk login involved) is an accepted
  // break-glass alternative to the normal admin-session check below.
  if (!isAuthorizedByHealthToken(request)) {
    const { response } = await requireAdminForApi(HEALTH_SCOPE);
    if (response) return response;
  }

  const missing = getMissingClerkEnv();
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
  const decoded = publishableKey
    ? decodePublishableKey(publishableKey)
    : { instanceType: "unknown" as const, frontendApiHost: null, decodeError: "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is not set." };

  const appUrlHost = (() => {
    const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
    if (!raw) return null;
    try {
      return new URL(raw).hostname.toLowerCase().replace(/^www\./, "");
    } catch {
      return null;
    }
  })();

  const cspAllowsFrontendApi = decoded.frontendApiHost ? isHostAllowedByCsp(decoded.frontendApiHost) : null;

  // A mismatch here is the classic post-rebrand symptom: Clerk's dashboard
  // custom domain was moved to the new site, but the publishable/secret keys
  // in Vercel still encode the old domain, or vice versa.
  const domainMismatch =
    decoded.frontendApiHost && appUrlHost ? baseDomain(decoded.frontendApiHost) !== baseDomain(appUrlHost) : null;

  const result: Record<string, unknown> = {
    configured: missing.length === 0,
    ...(missing.length > 0 ? { missing } : {}),
    publishableKey: {
      present: Boolean(publishableKey),
      instanceType: decoded.instanceType,
      frontendApiHost: decoded.frontendApiHost,
      decodeError: decoded.decodeError,
    },
    appUrlHost,
    domainMismatch,
    cspAllowsFrontendApi,
    runtime: getRuntimeDiagnostics(),
  };

  if (request.nextUrl.searchParams.get("probe") === "network" && decoded.frontendApiHost) {
    result.networkProbe = await probeFrontendApiHost(decoded.frontendApiHost);
  }

  return NextResponse.json(result);
}
