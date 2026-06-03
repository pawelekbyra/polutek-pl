export type VideoTitleLanguage = 'pl' | 'en' | string;

type VideoTitleSource = {
  slug?: string | null;
  title?: string | null;
  tier?: string | null;
};

/**
 * Legancy overrides removed to ensure database titles are always respected.
 * If you need to translate titles, consider adding a translation table to the DB.
 */
export function getVideoDisplayTitle(video: VideoTitleSource, _language: VideoTitleLanguage = 'en') {
  return video.title || '';
}

export function getCanonicalVideoTitle(video: VideoTitleSource) {
  return video.title || '';
}
