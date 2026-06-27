import { createSign } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type DiagnosticStatus = "ok" | "missing" | "invalid" | "unauthorized";

function hasValue(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function readPrivateKeyEnv() {
  const privateKey = process.env.CLOUDFLARE_STREAM_SIGNING_PRIVATE_KEY;
  const pemKey = process.env.CLOUDFLARE_STREAM_SIGNING_KEY_PEM;

  if (hasValue(privateKey)) {
    return {
      envName: "CLOUDFLARE_STREAM_SIGNING_PRIVATE_KEY",
      raw: privateKey!,
    };
  }

  if (hasValue(pemKey)) {
    return {
      envName: "CLOUDFLARE_STREAM_SIGNING_KEY_PEM",
      raw: pemKey!,
    };
  }

  return null;
}

function normalizePrivateKey(raw: string): string {
  return raw.includes("\\n") ? raw.replace(/\\n/g, "\n") : raw;
}

function getToken(req: NextRequest): string | null {
  return (
    req.headers.get("x-healthcheck-token") ||
    req.headers.get("x-diagnostics-token") ||
    req.nextUrl.searchParams.get("token")
  );
}

function validatePrivateKey(raw: string) {
  const normalized = normalizePrivateKey(raw);
  const hasPemHeader = /-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(normalized);
  const hasPemFooter = /-----END [A-Z ]*PRIVATE KEY-----/.test(normalized);

  try {
    createSign("RSA-SHA256").update("polutek-cloudflare-stream-diagnostic").end().sign(normalized);
    return {
      valid: true,
      hasPemHeader,
      hasPemFooter,
      error: null,
    };
  } catch (error) {
    return {
      valid: false,
      hasPemHeader,
      hasPemFooter,
      error: error instanceof Error ? error.message : "Unknown private key parse/signing error",
    };
  }
}

export async function GET(req: NextRequest) {
  const expectedToken = process.env.HEALTHCHECK_TOKEN;
  const token = getToken(req);

  if (!hasValue(expectedToken) || token !== expectedToken) {
    return NextResponse.json(
      {
        status: "unauthorized" satisfies DiagnosticStatus,
        message: "Missing or invalid diagnostics token.",
      },
      { status: 401 },
    );
  }

  const keyId = process.env.CLOUDFLARE_STREAM_SIGNING_KEY_ID;
  const privateKeyEnv = readPrivateKeyEnv();
  const missing: string[] = [];

  if (!hasValue(keyId)) missing.push("CLOUDFLARE_STREAM_SIGNING_KEY_ID");
  if (!privateKeyEnv) {
    missing.push("CLOUDFLARE_STREAM_SIGNING_PRIVATE_KEY or CLOUDFLARE_STREAM_SIGNING_KEY_PEM");
  }

  const privateKeyValidation = privateKeyEnv
    ? validatePrivateKey(privateKeyEnv.raw)
    : null;

  const invalid: string[] = [];
  if (privateKeyValidation && !privateKeyValidation.valid) {
    invalid.push(privateKeyEnv!.envName);
  }

  const ok = missing.length === 0 && invalid.length === 0;

  return NextResponse.json({
    status: ok ? "ok" : (missing.length > 0 ? "missing" : "invalid") satisfies DiagnosticStatus,
    cloudflareStreamSigning: {
      configured: ok,
      required: {
        keyId: "CLOUDFLARE_STREAM_SIGNING_KEY_ID",
        privateKey: "CLOUDFLARE_STREAM_SIGNING_PRIVATE_KEY or CLOUDFLARE_STREAM_SIGNING_KEY_PEM",
      },
      present: {
        keyId: hasValue(keyId),
        privateKey: Boolean(privateKeyEnv),
      },
      selectedPrivateKeyEnv: privateKeyEnv?.envName ?? null,
      missing,
      invalid,
      privateKeyFormat: privateKeyEnv && privateKeyValidation ? {
        containsEscapedNewlines: privateKeyEnv.raw.includes("\\n"),
        hasPemHeader: privateKeyValidation.hasPemHeader,
        hasPemFooter: privateKeyValidation.hasPemFooter,
        canSignDiagnosticPayload: privateKeyValidation.valid,
        error: privateKeyValidation.error,
      } : null,
    },
  });
}
