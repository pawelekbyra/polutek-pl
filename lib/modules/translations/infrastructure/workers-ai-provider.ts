import { DraftProviderError, type DraftEnv, type TranslationDraftProvider } from "../domain/draft-provider";

/**
 * Cloudflare Workers AI, model @cf/meta/m2m100-1.2b (translation). Free: 10,000 neurons per day on the Workers
 * Free plan, no card; past the limit calls FAIL (no charge) until 00:00 UTC. A film's title and description are a
 * few hundred tokens, so a film costs a small fraction of the allowance.
 * https://developers.cloudflare.com/workers-ai/platform/pricing/ ,
 * https://developers.cloudflare.com/workers-ai/models/m2m100-1.2b/
 */
const MODEL = "@cf/meta/m2m100-1.2b";

export function createWorkersAiProvider(env: DraftEnv = process.env, fetchImpl: typeof fetch = fetch): TranslationDraftProvider {
  const account = env.CLOUDFLARE_AI_ACCOUNT_ID?.trim();
  const token = env.CLOUDFLARE_AI_API_TOKEN?.trim();
  if (!account || !token) throw new DraftProviderError("Workers AI nie jest skonfigurowane.", "unavailable");
  return {
    name: "cloudflare-workers-ai",
    async translate({ text, from, to }) {
      let res: Response;
      try {
        res = await fetchImpl(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(account)}/ai/run/${MODEL}`, {
          method: "POST",
          headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
          body: JSON.stringify({ text, source_lang: from, target_lang: to }),
          signal: AbortSignal.timeout(20_000),
        });
      } catch {
        throw new DraftProviderError("Workers AI nie odpowiada.", "unavailable");
      }
      if (res.status === 429 || res.status === 402) throw new DraftProviderError("Dzienny limit Workers AI wyczerpany (reset o 00:00 UTC).", "quota");
      const body = (await res.json().catch(() => null)) as { success?: boolean; result?: { translated_text?: string }; errors?: { code?: number; message?: string }[] } | null;
      if (!res.ok || !body?.success) {
        // Cloudflare code 4006 = "daily free allocation of neurons used up".
        if (body?.errors?.some((e) => e.code === 4006)) throw new DraftProviderError("Dzienny limit Workers AI wyczerpany (reset o 00:00 UTC).", "quota");
        throw new DraftProviderError(`Workers AI odrzuciło zapytanie (HTTP ${res.status}).`, "unavailable");
      }
      const out = body.result?.translated_text;
      if (typeof out !== "string" || !out.trim()) throw new DraftProviderError("Workers AI zwróciło pustą odpowiedź.", "bad_response");
      return out.trim();
    },
  };
}
