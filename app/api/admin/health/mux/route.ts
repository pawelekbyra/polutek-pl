import { NextRequest, NextResponse } from "next/server";
import { requireAdminForApi } from "@/lib/auth-utils";

export const dynamic = "force-dynamic";

type MuxDiagnosis =
  | "MISSING_ENV"
  | "INVALID_SIGNING_KEY_FORMAT"
  | "MUX_READ_OK"
  | "AUTH_FAILED"
  | "PERMISSION_DENIED"
  | "MUX_REQUEST_FAILED"
  | "NETWORK_OR_RUNTIME_ERROR"
  | "DIRECT_UPLOAD_OK";

const STREAM_READ_SCOPE = "GET_ADMIN_MUX_HEALTH";
const DIRECT_UPLOAD_SCOPE = "POST_ADMIN_MUX_HEALTH";

function getMissingMuxEnv() {
  return [
    !process.env.MUX_TOKEN_ID ? "MUX_TOKEN_ID" : null,
    !process.env.MUX_TOKEN_SECRET ? "MUX_TOKEN_SECRET" : null,
    !process.env.MUX_WEBHOOK_SECRET ? "MUX_WEBHOOK_SECRET" : null,
  ].filter(Boolean) as string[];
}

function getMissingMuxSigningEnv() {
  return [
    !process.env.MUX_SIGNING_KEY_ID ? "MUX_SIGNING_KEY_ID" : null,
    !process.env.MUX_SIGNING_PRIVATE_KEY ? "MUX_SIGNING_PRIVATE_KEY" : null,
  ].filter(Boolean) as string[];
}

function isValidBase64Pem(value: string): boolean {
  try {
    const decoded = Buffer.from(value, "base64").toString("utf-8");
    return decoded.includes("-----BEGIN") && decoded.includes("-----END");
  } catch {
    return false;
  }
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

function muxAuthHeaders() {
  const token = `${process.env.MUX_TOKEN_ID}:${process.env.MUX_TOKEN_SECRET}`;
  return {
    Authorization: `Basic ${Buffer.from(token).toString("base64")}`,
    "Content-Type": "application/json",
  };
}

function diagnoseMuxFailure(status: number): MuxDiagnosis {
  if (status === 401) return "AUTH_FAILED";
  if (status === 403) return "PERMISSION_DENIED";
  return "MUX_REQUEST_FAILED";
}

function baseHealthResponse() {
  const missing = getMissingMuxEnv();
  const signingMissing = getMissingMuxSigningEnv();
  const signingKey = process.env.MUX_SIGNING_PRIVATE_KEY;
  const signingKeyValid = signingKey ? isValidBase64Pem(signingKey) : null;

  return NextResponse.json({
    configured: missing.length === 0,
    ...(missing.length > 0 ? { missing } : {}),
    signing: {
      configured: signingMissing.length === 0,
      ...(signingMissing.length > 0 ? { missing: signingMissing } : {}),
      ...(signingKey !== undefined ? { keyFormatValid: signingKeyValid } : {}),
    },
    runtime: getRuntimeDiagnostics(),
  });
}

async function authProbeResponse() {
  const missing = getMissingMuxEnv();
  if (missing.length > 0) {
    return NextResponse.json({ ok: false, configured: false, diagnosis: "MISSING_ENV", missing });
  }

  const signingKey = process.env.MUX_SIGNING_PRIVATE_KEY;
  if (signingKey && !isValidBase64Pem(signingKey)) {
    return NextResponse.json({
      ok: false,
      configured: true,
      diagnosis: "INVALID_SIGNING_KEY_FORMAT",
      description: "MUX_SIGNING_PRIVATE_KEY must be a base64-encoded PEM private key.",
    });
  }

  try {
    const response = await fetch("https://api.mux.com/video/v1/assets?limit=1", {
      method: "GET",
      headers: muxAuthHeaders(),
      cache: "no-store",
    });

    if (response.ok) {
      return NextResponse.json({ ok: true, configured: true, diagnosis: "MUX_READ_OK" });
    }

    const diagnosis = diagnoseMuxFailure(response.status);
    return NextResponse.json(
      { ok: false, configured: true, status: response.status, diagnosis },
      { status: 200 },
    );
  } catch {
    return NextResponse.json({ ok: false, configured: true, diagnosis: "NETWORK_OR_RUNTIME_ERROR" });
  }
}

async function directUploadProbeResponse() {
  const missing = getMissingMuxEnv();
  if (missing.length > 0) {
    return NextResponse.json({ ok: false, configured: false, diagnosis: "MISSING_ENV", missing });
  }

  try {
    const response = await fetch("https://api.mux.com/video/v1/uploads", {
      method: "POST",
      headers: muxAuthHeaders(),
      body: JSON.stringify({
        cors_origin: "*",
        new_asset_settings: { playback_policy: ["signed"] },
      }),
      cache: "no-store",
    });

    if (response.ok) {
      const payload = await response.json().catch(() => null);
      const uploadId: string =
        payload &&
        typeof payload === "object" &&
        (payload as { data?: { id?: unknown } }).data?.id
          ? String((payload as { data: { id: unknown } }).data.id)
          : "";
      return NextResponse.json({
        ok: true,
        diagnosis: "DIRECT_UPLOAD_OK",
        uploadIdPresent: uploadId.length > 0,
        uploadIdPrefix: uploadId ? uploadId.slice(0, 8) : null,
      });
    }

    const diagnosis = diagnoseMuxFailure(response.status);
    return NextResponse.json({ ok: false, status: response.status, diagnosis });
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
