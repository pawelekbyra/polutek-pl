import { createPrivateKey, createSign } from "node:crypto";
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
  const trimmed = raw.trim();
  const unquoted = (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) ? trimmed.slice(1, -1) : trimmed;

  return unquoted.includes("\\n") ? unquoted.replace(/\\n/g, "\n") : unquoted;
}

function getToken(req: NextRequest): string | null {
  return (
    req.headers.get("x-healthcheck-token") ||
    req.headers.get("x-diagnostics-token") ||
    req.nextUrl.searchParams.get("token")
  );
}

function getPemSummary(raw: string, normalized: string) {
  const lines = normalized.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const headerLine = lines[0] ?? null;
  const footerLine = lines[lines.length - 1] ?? null;
  const body = lines.slice(1, -1).join("");

  return {
    containsEscapedNewlines: raw.includes("\\n"),
    startsWithQuote: raw.trim().startsWith('"') || raw.trim().startsWith("'"),
    endsWithQuote: raw.trim().endsWith('"') || raw.trim().endsWith("'"),
    lineCount: lines.length,
    headerLine,
    footerLine,
    bodyLooksBase64: body.length > 0 && /^[A-Za-z0-9+/=]+$/.test(body),
    bodyLength: body.length,
  };
}

function validatePrivateKey(raw: string) {
  const normalized = normalizePrivateKey(raw);
  const pemSummary = getPemSummary(raw, normalized);
  const hasPemHeader = /-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(normalized);
  const hasPemFooter = /-----END [A-Z ]*PRIVATE KEY-----/.test(normalized);

  try {
    const keyObject = createPrivateKey(normalized);

    try {
      createSign("RSA-SHA256")
        .update("polutek-cloudflare-stream-diagnostic")
        .end()
        .sign(keyObject);

      return {
        valid: true,
        hasPemHeader,
        hasPemFooter,
        keyType: keyObject.asymmetricKeyType ?? null,
        canCreatePrivateKey: true,
        canSignDiagnosticPayload: true,
        error: null,
        pemSummary,
      };
    } catch (signError) {
      return {
        valid: false,
        hasPemHeader,
        hasPemFooter,
        keyType: keyObject.asymmetricKeyType ?? null,
        canCreatePrivateKey: true,
        canSignDiagnosticPayload: false,
        error: signError instanceof Error ? signError.message : "Unknown signing error",
        pemSummary,
      };
    }
  } catch (parseError) {
    return {
      valid: false,
      hasPemHeader,
      hasPemFooter,
      keyType: null,
      canCreatePrivateKey: false,
      canSignDiagnosticPayload: false,
      error: parseError instanceof Error ? parseError.message : "Unknown private key parse error",
      pemSummary,
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
        containsEscapedNewlines: privateKeyValidation.pemSummary.containsEscapedNewlines,
        startsWithQuote: privateKeyValidation.pemSummary.startsWithQuote,
        endsWithQuote: privateKeyValidation.pemSummary.endsWithQuote,
        lineCount: privateKeyValidation.pemSummary.lineCount,
        headerLine: privateKeyValidation.pemSummary.headerLine,
        footerLine: privateKeyValidation.pemSummary.footerLine,
        bodyLooksBase64: privateKeyValidation.pemSummary.bodyLooksBase64,
        bodyLength: privateKeyValidation.pemSummary.bodyLength,
        hasPemHeader: privateKeyValidation.hasPemHeader,
        hasPemFooter: privateKeyValidation.hasPemFooter,
        keyType: privateKeyValidation.keyType,
        canCreatePrivateKey: privateKeyValidation.canCreatePrivateKey,
        canSignDiagnosticPayload: privateKeyValidation.canSignDiagnosticPayload,
        error: privateKeyValidation.error,
      } : null,
    },
  });
}
