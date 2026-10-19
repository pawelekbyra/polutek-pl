/** Values of the search filters, shared by the browser form and the server parser (client-safe, no imports). */
export const SEARCH_SORTS = ["relevance", "newest", "views"] as const;
export type SearchSort = (typeof SEARCH_SORTS)[number];

export const SEARCH_DURATIONS = ["short", "medium", "long"] as const;
export type SearchDuration = (typeof SEARCH_DURATIONS)[number];

export const SEARCH_UPLOADED = ["day", "week", "month", "year"] as const;
export type SearchUploaded = (typeof SEARCH_UPLOADED)[number];
