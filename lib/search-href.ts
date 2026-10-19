/**
 * Query string of a search page link or API call: only set values, stable order. Client-safe (no server imports),
 * so cards, chips and the server page build the same URLs.
 */
export interface SearchHrefParams {
  q?: string | null;
  category?: string | null;
  tag?: string | null;
  channel?: string | null;
  duration?: string | null;
  uploaded?: string | null;
  sort?: string | null;
  cursor?: string | null;
}

export function buildSearchQuery(params: SearchHrefParams): string {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.category) query.set("category", params.category);
  if (params.tag) query.set("tag", params.tag);
  if (params.channel) query.set("channel", params.channel);
  if (params.duration) query.set("duration", params.duration);
  if (params.uploaded) query.set("uploaded", params.uploaded);
  if (params.sort && params.sort !== "relevance") query.set("sort", params.sort);
  if (params.cursor) query.set("cursor", params.cursor);
  return query.toString();
}
