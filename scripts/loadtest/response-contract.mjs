const EXPECTED_CONTENT_TYPES = {
  home: (value) => value === 'text/html' || value === 'application/xhtml+xml',
  sidebar: (value) => value === 'application/json' || value === 'application/problem+json',
  comments: (value) => value === 'application/json' || value === 'application/problem+json',
  media: (value) => value === 'application/json' || value === 'application/problem+json',
  thumb: (value) => value.startsWith('image/'),
};

/** Validate the response envelope even when k6 discards the body to cap its memory use. */
export function hasExpectedLoadContentType(endpoint, headers = {}) {
  const entry = Object.entries(headers).find(([name]) => name.toLowerCase() === 'content-type');
  const contentType = String(entry?.[1] ?? '').split(';', 1)[0].trim().toLowerCase();
  return Boolean(EXPECTED_CONTENT_TYPES[endpoint]?.(contentType));
}
