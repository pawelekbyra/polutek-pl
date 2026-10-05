/**
 * "Generuj szkice AI": the provider interface. The feature is OFF unless TRANSLATION_AI_ENABLED=1 and the
 * provider is configured; tests use a fake. Decision and sources: docs/architecture/admin-phase3.md section 6.
 */
export type DraftProviderLang = "pl" | "en" | "de" | "es" | "fr" | "it" | "pt" | "zh";

export interface TranslationDraftProvider {
  readonly name: string;
  translate(input: { text: string; from: DraftProviderLang; to: string }): Promise<string>;
}

export class DraftProviderError extends Error {
  constructor(message: string, readonly kind: "quota" | "unavailable" | "bad_response") {
    super(message);
    this.name = "DraftProviderError";
  }
}

export type DraftEnv = Record<string, string | undefined>;

/** Feature flag + credentials present. Never throws, never reveals a value. */
export function draftAiStatus(env: DraftEnv = process.env): { enabled: boolean; reason: string | null } {
  if (env.TRANSLATION_AI_ENABLED !== "1") return { enabled: false, reason: "Wyłączone (TRANSLATION_AI_ENABLED nie jest ustawione na 1)." };
  if (!env.CLOUDFLARE_AI_ACCOUNT_ID?.trim() || !env.CLOUDFLARE_AI_API_TOKEN?.trim()) return { enabled: false, reason: "Brakuje CLOUDFLARE_AI_ACCOUNT_ID albo CLOUDFLARE_AI_API_TOKEN." };
  return { enabled: true, reason: null };
}
