/**
 * R2 diagnostics (System → Diagnostyka R2; replaces the retired www diagnostics route): which R2
 * variables the process has, whether bucket names look right, and (on request) a HeadBucket per bucket.
 * Never returns a secret: secret variables show only "ustawiona", others a shortened value.
 */
import { HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";

export type R2VarDefinition = { name: string; secret: boolean; bucket: boolean; required: boolean; expected: string };

export const R2_VARS: readonly R2VarDefinition[] = [
  { name: "CLOUDFLARE_R2_ACCOUNT_ID", secret: false, bucket: false, required: true, expected: "Account ID Cloudflare (nie token); z niego powstaje adres https://<id>.r2.cloudflarestorage.com." },
  { name: "CLOUDFLARE_R2_ACCESS_KEY_ID", secret: true, bucket: false, required: true, expected: "Access Key ID z danych S3 tokenu R2." },
  { name: "CLOUDFLARE_R2_SECRET_ACCESS_KEY", secret: true, bucket: false, required: true, expected: "Secret Access Key z tej samej pary (nie wartość pola Token)." },
  { name: "CLOUDFLARE_R2_BUCKET_VIDEO_ORIGINALS", secret: false, bucket: true, required: true, expected: "Nazwa bucketu z oryginałami filmów, bez https:// i bez ścieżki." },
  { name: "CLOUDFLARE_R2_BUCKET_THUMBNAILS_PRIVATE", secret: false, bucket: true, required: true, expected: "Prywatny bucket miniatur (okładki, domyślna miniatura)." },
  { name: "CLOUDFLARE_R2_BUCKET_THUMBNAILS_PUBLIC", secret: false, bucket: true, required: false, expected: "Publiczny bucket miniatur i napisów (serwowany przez NEXT_PUBLIC_R2_PUBLIC_HOST)." },
  { name: "CLOUDFLARE_R2_BUCKET_HLS", secret: false, bucket: true, required: false, expected: "Bucket z wersjami HLS (zapisuje encoder; panel ich nie czyta bezpośrednio)." },
] as const;

type Env = Record<string, string | undefined>;
const present = (v: string | undefined) => typeof v === "string" && v.trim().length > 0;

export function bucketNameProblem(value: string | undefined): string | null {
  if (!present(value)) return "Brak nazwy bucketu.";
  const v = value!.trim();
  if (/^https?:\/\//i.test(v)) return "Wpisano adres URL; ma być sama nazwa bucketu, bez https://.";
  if (v.includes("/")) return "Nazwa bucketu nie może zawierać ukośników ani ścieżki.";
  return null;
}

export function previewR2Value(def: R2VarDefinition, value: string | undefined): string | null {
  if (!present(value)) return null;
  const v = value!.trim();
  if (def.secret) return "ustawiona (wartość ukryta)";
  if (def.bucket) return v;
  return v.length <= 8 ? v : `${v.slice(0, 6)}…${v.slice(-4)}`;
}

export function hintForR2Error(name: string | undefined, status: number | undefined, bucketVar: string): string {
  if (status === 403) return "Cloudflare odrzucił dostęp: sprawdź, czy Access Key ID i Secret to jedna para i czy token ma prawa do tego bucketu.";
  if (status === 404 || name === "NotFound" || name === "NoSuchBucket") return `Bucket nie istnieje: sprawdź ${bucketVar} i czy leży na tym samym koncie co CLOUDFLARE_R2_ACCOUNT_ID.`;
  if (name === "CredentialsProviderError") return "SDK nie widzi poprawnych danych dostępowych (ACCESS_KEY_ID / SECRET_ACCESS_KEY).";
  return "Nie udało się potwierdzić połączenia z R2: sprawdź komplet zmiennych, uprawnienia tokenu i restart kontenera po zmianie.";
}

export type R2Variable = { name: string; present: boolean; required: boolean; preview: string | null; expected: string; problem: string | null };
export type R2BucketCheck = { variable: string; bucket: string; ok: boolean; message: string; hint?: string };
export type R2Diagnostics = { configured: boolean; missingRequired: string[]; variables: R2Variable[]; connection: { checked: boolean; buckets: R2BucketCheck[] } };

export type HeadBucketFn = (bucket: string) => Promise<void>;

function defaultHeadBucket(env: Env): HeadBucketFn {
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${env.CLOUDFLARE_R2_ACCOUNT_ID!.trim()}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: env.CLOUDFLARE_R2_ACCESS_KEY_ID!.trim(), secretAccessKey: env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!.trim() },
  });
  return async (bucket) => {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
  };
}

/** `testConnection=false` only inspects the environment (instant, offline); true also HEADs every configured bucket. */
export async function diagnoseR2(opts: { env?: Env; testConnection: boolean; head?: HeadBucketFn }): Promise<R2Diagnostics> {
  const env = opts.env ?? process.env;
  const variables: R2Variable[] = R2_VARS.map((def) => ({
    name: def.name,
    present: present(env[def.name]),
    required: def.required,
    preview: previewR2Value(def, env[def.name]),
    expected: def.expected,
    problem: def.bucket && present(env[def.name]) ? bucketNameProblem(env[def.name]) : null,
  }));
  const missingRequired = variables.filter((v) => v.required && !v.present).map((v) => v.name);
  const configured = missingRequired.length === 0 && variables.every((v) => !v.problem);

  const buckets: R2BucketCheck[] = [];
  if (opts.testConnection && configured) {
    const head = opts.head ?? defaultHeadBucket(env);
    for (const def of R2_VARS.filter((d) => d.bucket && present(env[d.name]))) {
      const bucket = env[def.name]!.trim();
      try {
        await head(bucket);
        buckets.push({ variable: def.name, bucket, ok: true, message: "Połączenie OK: dane dostępowe pasują do bucketu." });
      } catch (error) {
        const e = error as { name?: string; $metadata?: { httpStatusCode?: number } };
        buckets.push({ variable: def.name, bucket, ok: false, message: "Zmienne są ustawione, ale test dostępu do bucketu nie przeszedł.", hint: hintForR2Error(e.name, e.$metadata?.httpStatusCode, def.name) });
      }
    }
  }
  return { configured, missingRequired, variables, connection: { checked: opts.testConnection && configured, buckets } };
}
