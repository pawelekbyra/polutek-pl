const EXPECTED_CONTENT_TYPES = {
  home: (value) => value === 'text/html' || value === 'application/xhtml+xml',
  sidebar: (value) => value === 'application/json' || value === 'application/problem+json',
  comments: (value) => value === 'application/json' || value === 'application/problem+json',
  media: (value) => value === 'application/json' || value === 'application/problem+json',
  thumb: (value) => value.startsWith('image/'),
};

/** Validate the response MIME envelope even when k6 discards the body. */
export function hasExpectedLoadContentType(endpoint, headers = {}) {
  const entry = Object.entries(headers).find(([name]) => name.toLowerCase() === 'content-type');
  const contentType = String(entry?.[1] ?? '').split(';', 1)[0].trim().toLowerCase();
  return Boolean(EXPECTED_CONTENT_TYPES[endpoint]?.(contentType));
}

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isString = (value) => typeof value === 'string' && value.length > 0;
const isNonNegativeInteger = (value) => Number.isInteger(value) && value >= 0;

/** Validate small JSON API bodies; HTML and image bodies intentionally remain discarded by k6. */
export function hasExpectedLoadResponseBody(endpoint, body) {
  if (endpoint === 'home' || endpoint === 'thumb') return true;
  if (!['sidebar', 'comments', 'media'].includes(endpoint) || typeof body !== 'string') return false;

  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    return false;
  }
  if (!isRecord(payload)) return false;

  if (endpoint === 'sidebar') {
    return ['ANONYMOUS', 'LOGGED_IN', 'ADMIN'].includes(payload.viewerState)
      && isString(payload.currentVideoId)
      && Array.isArray(payload.sections)
      && payload.sections.length > 0
      && payload.sections.every((section) => isRecord(section)
        && isString(section.id)
        && ['FREE', 'LOGGED_IN', 'UPCOMING', 'ANNOUNCEMENT'].includes(section.type)
        && isString(section.title)
        && Array.isArray(section.items)
        && isNonNegativeInteger(section.total)
        && section.items.every((item) => isRecord(item)
          && isString(item.id)
          && isString(item.slug)
          && isString(item.title)
          && isString(item.thumbnailUrl)));
  }

  if (endpoint === 'comments') {
    return payload.success === true
      && Array.isArray(payload.comments)
      && isNonNegativeInteger(payload.totalCount)
      && (payload.nextCursor === null || isString(payload.nextCursor))
      && isRecord(payload.viewer)
      && ['canComment', 'canReact', 'canReport', 'canModerate', 'commentsDisabled']
        .every((key) => typeof payload.viewer[key] === 'boolean');
  }

  return isString(payload.videoId)
    && payload.status === 'READY'
    && payload.canPlay === true
    && isRecord(payload.access)
    && payload.access.allowed === true
    && isRecord(payload.source)
    && isString(payload.source.playbackUrl);
}
