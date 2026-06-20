import { NextRequest, NextResponse } from "next/server";
import { requireAdminForApi } from "@/lib/auth-utils";

export const dynamic = "force-dynamic";

type CloudflareDiagnosis =
  | "MISSING_ENV"
  | "TOKEN_HAS_BEARER_PREFIX"
  | "STREAM_READ_OK"
  | "AUTH_FAILED_OR_ACCOUNT_MISMATCH"
  | "AUTH_FAILED_OR_PERMISSION_MISSING"
  | "ACCOUNT_OR_STREAM_RESOURCE_NOT_FOUND"
  | "CLOUDFLARE_REQUEST_FAILED"
  | "NETWORK_OR_RUNTIME_ERROR"
  | "DIRECT_UPLOAD_OK";

type RedactedCloudflareError = { code: number | string | null; message: string };

const STREAM_READ_SCOPE = "GET_ADMIN_CLOUDFLARE_HEALTH";
const DIRECT_UPLOAD_SCOPE = "POST_ADMIN_CLOUDFLARE_HEALTH";
const AUTH_9106_DESCRIPTION =
  "Cloudflare authentication failed. Check CLOUDFLARE_API_TOKEN, token permissions, and whether CLOUDFLARE_ACCOUNT_ID matches the token account.";

function getMissingCloudflareEnv() {
  return [
    !process.env.CLOUDFLARE_ACCOUNT_ID ? "CLOUDFLARE_ACCOUNT_ID" : null,
    !process.env.CLOUDFLARE_API_TOKEN ? "CLOUDFLARE_API_TOKEN" : null,
    !process.env.CLOUDFLARE_WEBHOOK_SECRET ? "CLOUDFLARE_WEBHOOK_SECRET" : null,
  ].filter(Boolean) as string[];
}

function getRuntimeDiagnostics() {
  return {
    nodeEnv: process.env.NODE_ENV || null,
    vercelEnv: process.env.VERCEL_ENV || null,
    vercelUrl: process.env.VERCEL_URL || null,
    productionUrl: process.env.VERCEL_PROJECT_PRODUCTION_URL || null,
    gitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA || null,
    gitCommitRef: process.env.VERCEL_GIT_COMMIT_REF || null,
  };
}

function redactCloudflareErrors(payload: unknown): RedactedCloudflareError[] {
  const errors =
    payload && typeof payload === "object" && Array.isArray((payload as { errors?: unknown }).errors)
      ? (payload as { errors: unknown[] }).errors
      : [];

  return errors.map((error) => {
    if (!error || typeof error !== "object") return { code: null, message: "Unknown Cloudflare error" };
    const candidate = error as { code?: unknown; message?: unknown };
    return {
      code: typeof candidate.code === "number" || typeof candidate.code === "string" ? candidate.code : null,
      message: typeof candidate.message === "string" ? candidate.message : "Unknown Cloudflare error",
    };
  });
}

function hasCloudflareErrorCode(errors: RedactedCloudflareError[], code: number) {
  return errors.some((error) => String(error.code) === String(code));
}

function diagnoseCloudflareFailure(status: number, errors: RedactedCloudflareError[]): CloudflareDiagnosis {
  if (hasCloudflareErrorCode(errors, 9106)) return "AUTH_FAILED_OR_ACCOUNT_MISMATCH";
  if (status === 401) return "AUTH_FAILED_OR_ACCOUNT_MISMATCH";
  if (status === 403) return "AUTH_FAILED_OR_PERMISSION_MISSING";
  if (status === 404) return "ACCOUNT_OR_STREAM_RESOURCE_NOT_FOUND";
  return "CLOUDFLARE_REQUEST_FAILED";
}

function authHeaders() {
  return {
    Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
    "Content-Type": "application/json",
  };
}

function baseHealthResponse() {
  const missing = getMissingCloudflareEnv();

  return NextResponse.json({
    configured: missing.length === 0,
    ...(missing.length > 0 ? { missing } : {}),
    runtime: getRuntimeDiagnostics(),
  });
}

async function authProbeResponse() {
  const missing = getMissingCloudflareEnv();
  if (missing.length > 0) {
    return NextResponse.json({ ok: false, configured: false, diagnosis: "MISSING_ENV", missing });
  }

  const token = process.env.CLOUDFLARE_API_TOKEN ?? "";
  if (token.trimStart().startsWith("Bearer ")) {
    return NextResponse.json({ ok: false, configured: true, diagnosis: "TOKEN_HAS_BEARER_PREFIX" });
  }

  try {
    const accountId = encodeURIComponent(process.env.CLOUDFLARE_ACCOUNT_ID ?? "");
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/stream?per_page=1`, {
      method: "GET",
      headers: authHeaders(),
      cache: "no-store",
    });
    const payload = await response.json().catch(() => null);
    const cloudflareErrors = redactCloudflareErrors(payload);

    if (response.ok && payload && typeof payload === "object" && (payload as { success?: unknown }).success === true) {
      return NextResponse.json({ ok: true, configured: true, diagnosis: "STREAM_READ_OK", cloudflareErrors });
    }

    const diagnosis = diagnoseCloudflareFailure(response.status, cloudflareErrors);
    return NextResponse.json(
      {
        ok: false,
        configured: true,
        status: response.status,
        diagnosis,
        ...(diagnosis === "AUTH_FAILED_OR_ACCOUNT_MISMATCH" ? { description: AUTH_9106_DESCRIPTION } : {}),
        cloudflareErrors,
      },
      { status: 200 },
    );
  } catch {
    return NextResponse.json({ ok: false, configured: true, diagnosis: "NETWORK_OR_RUNTIME_ERROR" });
  }
}

async function directUploadProbeResponse() {
  const missing = getMissingCloudflareEnv();
  if (missing.length > 0) {
    return NextResponse.json({ ok: false, configured: false, diagnosis: "MISSING_ENV", missing });
  }

  const token = process.env.CLOUDFLARE_API_TOKEN ?? "";
  if (token.trimStart().startsWith("Bearer ")) {
    return NextResponse.json({ ok: false, configured: true, diagnosis: "TOKEN_HAS_BEARER_PREFIX" });
  }

  try {
    const accountId = encodeURIComponent(process.env.CLOUDFLARE_ACCOUNT_ID ?? "");
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/direct_upload`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ maxDurationSeconds: 60 }),
      cache: "no-store",
    });
    const payload = await response.json().catch(() => null);
    const cloudflareErrors = redactCloudflareErrors(payload);

    if (response.ok && payload && typeof payload === "object" && (payload as { success?: unknown }).success === true) {
      const result = (payload as { result?: { uid?: unknown; uploadURL?: unknown } }).result ?? {};
      const uid = typeof result.uid === "string" ? result.uid : "";
      return NextResponse.json({
        ok: true,
        diagnosis: "DIRECT_UPLOAD_OK",
        uidPresent: uid.length > 0,
        uidPrefix: uid ? uid.slice(0, 8) : null,
        uploadUrlPresent: typeof result.uploadURL === "string" && result.uploadURL.length > 0,
      });
    }

    const diagnosis = diagnoseCloudflareFailure(response.status, cloudflareErrors);
    return NextResponse.json({
      ok: false,
      status: response.status,
      diagnosis,
      ...(diagnosis === "AUTH_FAILED_OR_ACCOUNT_MISMATCH" ? { description: AUTH_9106_DESCRIPTION } : {}),
      cloudflareErrors,
    });
  } catch {
    return NextResponse.json({ ok: false, configured: true, diagnosis: "NETWORK_OR_RUNTIME_ERROR" });
  }
}

export async function GET(request: NextRequest) {
  const { response } = await requireAdminForApi(STREAM_READ_SCOPE);
  if (response) return response;

  if (request.nextUrl.searchParams.get("probe") === "auth") {
    return authProbeResponse();
  }

  return baseHealthResponse();
}

export async function POST(request: NextRequest) {
  const { response } = await requireAdminForApi(DIRECT_UPLOAD_SCOPE);
  if (response) return response;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || (body as { probe?: unknown }).probe !== "direct-upload") {
    return NextResponse.json({ ok: false, error: "Unsupported probe" }, { status: 400 });
  }

  return directUploadProbeResponse();
}
