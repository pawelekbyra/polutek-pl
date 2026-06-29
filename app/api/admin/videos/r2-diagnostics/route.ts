import { NextResponse } from "next/server";
import { S3Client, HeadBucketCommand } from "@aws-sdk/client-s3";
import { requireAdminForApi } from "@/lib/auth-utils";

const R2_ENV_DEFINITIONS = [
  {
    name: "CLOUDFLARE_R2_ACCOUNT_ID",
    secret: false,
    expected: "Cloudflare Account ID, nie token. Używane do endpointu https://<accountId>.r2.cloudflarestorage.com.",
    howToGet: "Cloudflare Dashboard → prawy panel konta / Workers & Pages / R2 → Account ID.",
  },
  {
    name: "CLOUDFLARE_R2_ACCESS_KEY_ID",
    secret: true,
    expected: "Access Key ID z R2 S3-compatible credentials.",
    howToGet: "Cloudflare Dashboard → R2 Object Storage → Manage R2 API Tokens → utwórz token/credentials dla R2 → Access Key ID.",
  },
  {
    name: "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
    secret: true,
    expected: "Secret Access Key z R2 S3-compatible credentials. To nie jest wartość pola Token.",
    howToGet: "Cloudflare Dashboard → R2 Object Storage → Manage R2 API Tokens → utwórz token/credentials dla R2 → Secret Access Key. Zapisz od razu, bo później może nie być widoczny.",
  },
  {
    name: "CLOUDFLARE_R2_BUCKET_VIDEO_ORIGINALS",
    secret: false,
    expected: "Dokładna nazwa bucketu R2 na oryginalne pliki wideo, bez https:// i bez domeny.",
    howToGet: "Cloudflare Dashboard → R2 Object Storage → Buckets → skopiuj nazwę bucketu, np. polutek-video-originals.",
  },
] as const;

function hasValue(value: string | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}

function previewValue(name: string, value: string | undefined, secret: boolean) {
  if (!hasValue(value)) return null;
  const trimmed = value!.trim();
  if (secret) return "ustawiona — wartość ukryta";
  if (name === "CLOUDFLARE_R2_BUCKET_VIDEO_ORIGINALS") return trimmed;
  if (trimmed.length <= 8) return trimmed;
  return `${trimmed.slice(0, 6)}…${trimmed.slice(-4)}`;
}

function validateBucketName(bucket: string | undefined) {
  if (!hasValue(bucket)) return "Brak nazwy bucketu.";
  const trimmed = bucket!.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return "Wpisano URL. Tu ma być sama nazwa bucketu, bez https://.";
  }
  if (trimmed.includes("/")) {
    return "Nazwa bucketu nie powinna zawierać slashy ani ścieżki.";
  }
  return null;
}

function hintForConnectionError(errorName: string | undefined, httpStatusCode: number | undefined) {
  if (httpStatusCode === 403) {
    return "Cloudflare odrzucił dostęp. Sprawdź, czy Access Key ID i Secret Access Key są z tej samej pary R2 credentials oraz czy token ma uprawnienia read/write do tego bucketu.";
  }
  if (httpStatusCode === 404 || errorName === "NotFound" || errorName === "NoSuchBucket") {
    return "Bucket nie został znaleziony. Sprawdź CLOUDFLARE_R2_BUCKET_VIDEO_ORIGINALS oraz czy bucket jest na tym samym koncie co CLOUDFLARE_R2_ACCOUNT_ID.";
  }
  if (errorName === "CredentialsProviderError") {
    return "SDK nie widzi poprawnych credentials. Sprawdź CLOUDFLARE_R2_ACCESS_KEY_ID i CLOUDFLARE_R2_SECRET_ACCESS_KEY.";
  }
  return "Nie udało się potwierdzić połączenia z R2. Sprawdź komplet envów, uprawnienia tokenu i redeploy po zmianach w Vercel.";
}

export async function GET() {
  const { response } = await requireAdminForApi("R2_DIAGNOSTICS");
  if (response) return response;

  const variables = R2_ENV_DEFINITIONS.map((definition) => {
    const value = process.env[definition.name];
    const present = hasValue(value);
    return {
      name: definition.name,
      present,
      preview: previewValue(definition.name, value, definition.secret),
      expected: definition.expected,
      howToGet: definition.howToGet,
    };
  });

  const missing = variables.filter((variable) => !variable.present).map((variable) => variable.name);
  const bucketWarning = validateBucketName(process.env.CLOUDFLARE_R2_BUCKET_VIDEO_ORIGINALS);
  const configured = missing.length === 0 && !bucketWarning;

  let connection: {
    checked: boolean;
    ok: boolean;
    message: string;
    errorName?: string;
    httpStatusCode?: number;
    hint?: string;
  } = {
    checked: false,
    ok: false,
    message: missing.length > 0
      ? `Brakuje zmiennych: ${missing.join(", ")}.`
      : bucketWarning ?? "Konfiguracja podstawowa wygląda poprawnie; test połączenia nie został wykonany.",
  };

  if (configured) {
    try {
      const client = new S3Client({
        region: "auto",
        endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID!.trim()}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!.trim(),
          secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!.trim(),
        },
      });

      await client.send(new HeadBucketCommand({ Bucket: process.env.CLOUDFLARE_R2_BUCKET_VIDEO_ORIGINALS!.trim() }));
      connection = {
        checked: true,
        ok: true,
        message: "Połączenie z R2 OK — credentials pasują do bucketu.",
      };
    } catch (err: unknown) {
      const candidate = err as { name?: string; $metadata?: { httpStatusCode?: number } };
      connection = {
        checked: true,
        ok: false,
        message: "Env-y są obecne, ale test dostępu do bucketu R2 nie przeszedł.",
        errorName: candidate.name,
        httpStatusCode: candidate.$metadata?.httpStatusCode,
        hint: hintForConnectionError(candidate.name, candidate.$metadata?.httpStatusCode),
      };
    }
  }

  return NextResponse.json({
    configured,
    missing,
    bucketWarning,
    variables,
    connection,
  });
}
