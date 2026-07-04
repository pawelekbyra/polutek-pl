import { NextRequest, NextResponse } from "next/server";
import { requireAdminForApi } from "@/lib/auth-utils";
import {
  createMuxWebhookSignature,
  MUX_WEBHOOK_TOLERANCE_SECONDS,
  verifyMuxWebhookSignature,
} from "@/lib/security/mux-webhook-signature";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MuxDiagnosis =
  | "MISSING_ENV"
  | "INVALID_SIGNING_KEY_FORMAT"
  | "MUX_READ_OK"
  | "AUTH_FAILED"
  | "PERMISSION_DENIED"
  | "MUX_REQUEST_FAILED"
  | "NETWORK_OR_RUNTIME_ERROR"
  | "DIRECT_UPLOAD_OK"
  | "WEBHOOK_SIGNATURE_OK"
  | "WEBHOOK_SIGNATURE_FAILED";

const STREAM_READ_SCOPE = "GET_ADMIN_MUX_HEALTH";
const DIRECT_UPLOAD_SCOPE = "POST_ADMIN_MUX_HEALTH";
const MUX_WEBHOOK_PATH = "/api/webhooks/mux";
const HANDLED_MUX_WEBHOOK_EVENTS = [
  "video.asset.ready",
  "video.asset.errored",
  "video.upload.asset_created",
] as const;

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

function normalizeOrigin(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(withProtocol).origin;
  } catch {
    return null;
  }
}

function getConfiguredAppOrigin() {
  return (
    normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL) ??
    normalizeOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL) ??
    normalizeOrigin(process.env.VERCEL_URL)
  );
}

function getWebhookDiagnostics() {
  const origin = getConfiguredAppOrigin();

  return {
    endpointPath: MUX_WEBHOOK_PATH,
    expectedUrl: origin ? `${origin}${MUX_WEBHOOK_PATH}` : null,
    appOriginPresent: Boolean(origin),
    secretConfigured: Boolean(process.env.MUX_WEBHOOK_SECRET),
    signatureHeader: "mux-signature",
    signatureToleranceSeconds: MUX_WEBHOOK_TOLERANCE_SECONDS,
    handledEvents: HANDLED_MUX_WEBHOOK_EVENTS,
  };
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
    webhook: getWebhookDiagnostics(),
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
    return NextResponse.json({ ok: false, configured: false, diagnosis: "MISSING_ENV", missing, webhook: getWebhookDiagnostics() });
  }

  const signingKey = process.env.MUX_SIGNING_PRIVATE_KEY;
  if (signingKey && !isValidBase64Pem(signingKey)) {
    return NextResponse.json({
      ok: false,
      configured: true,
      diagnosis: "INVALID_SIGNING_KEY_FORMAT",
      description: "MUX_SIGNING_PRIVATE_KEY must be a base64-encoded PEM private key.",
      webhook: getWebhookDiagnostics(),
    });
  }

  try {
    const response = await fetch("https://api.mux.com/video/v1/assets?limit=1", {
      method: "GET",
      headers: muxAuthHeaders(),
      cache: "no-store",
    });

    if (response.ok) {
      return NextResponse.json({ ok: true, configured: true, diagnosis: "MUX_READ_OK", webhook: getWebhookDiagnostics() });
    }

    const diagnosis = diagnoseMuxFailure(response.status);
    return NextResponse.json(
      { ok: false, configured: true, status: response.status, diagnosis, webhook: getWebhookDiagnostics() },
      { status: 200 },
    );
  } catch {
    return NextResponse.json({ ok: false, configured: true, diagnosis: "NETWORK_OR_RUNTIME_ERROR", webhook: getWebhookDiagnostics() });
  }
}

function webhookSignatureProbeResponse() {
  const webhookSecret = process.env.MUX_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({
      ok: false,
      configured: false,
      diagnosis: "MISSING_ENV",
      missing: ["MUX_WEBHOOK_SECRET"],
      webhook: getWebhookDiagnostics(),
    });
  }

  const syntheticPayload = JSON.stringify({
    type: "video.asset.ready",
    data: {
      id: "mux_diagnostic_asset",
      status: "ready",
      playback_ids: [{ id: "mux_diagnostic_playback", policy: "signed" }],
    },
  });
  const timestampSeconds = Math.floor(Date.now() / 1000);
  const syntheticSignature = createMuxWebhookSignature(syntheticPayload, webhookSecret, timestampSeconds);
  const verification = verifyMuxWebhookSignature(syntheticPayload, syntheticSignature, webhookSecret, Date.now());
  const diagnosis: MuxDiagnosis = verification.ok ? "WEBHOOK_SIGNATURE_OK" : "WEBHOOK_SIGNATURE_FAILED";

  return NextResponse.json({
    ok: verification.ok,
    configured: true,
    diagnosis,
    ...(verification.ok ? { ageSeconds: verification.ageSeconds } : { reason: verification.reason }),
    webhook: getWebhookDiagnostics(),
    proof: {
      syntheticPayloadVerified: verification.ok,
      signatureHeaderFormat: "t=<unix_timestamp>,v1=<hmac_sha256>",
      noExternalMuxRequest: true,
    },
  });
}

async function directUploadProbeResponse() {
  const missing = getMissingMuxEnv();
  if (missing.length > 0) {
    return NextResponse.json({ ok: false, configured: false, diagnosis: "MISSING_ENV", missing, webhook: getWebhookDiagnostics() });
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
        webhook: getWebhookDiagnostics(),
      });
    }

    const diagnosis = diagnoseMuxFailure(response.status);
    return NextResponse.json({ ok: false, status: response.status, diagnosis, webhook: getWebhookDiagnostics() });
  } catch {
    return NextResponse.json({ ok: false, configured: true, diagnosis: "NETWORK_OR_RUNTIME_ERROR", webhook: getWebhookDiagnostics() });
  }
}

export async function GET(request: NextRequest) {
  const { response } = await requireAdminForApi(STREAM_READ_SCOPE);
  if (response) return response;

  const probe = request.nextUrl.searchParams.get("probe");
  if (probe === "auth") {
    return authProbeResponse();
  }
  if (probe === "webhook-signature") {
    return webhookSignatureProbeResponse();
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
