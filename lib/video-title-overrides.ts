export type VideoTitleLanguage = 'pl' | 'en' | string;

type VideoTitleSource = {
  slug?: string | null;
  title?: string | null;
  titleEn?: string | null;
  tier?: string | null;
};

/**
 * Legancy overrides removed to ensure database titles are always respected.
 * If you need to translate titles, consider adding a translation table to the DB.
 */
export function getVideoDisplayTitle(video: VideoTitleSource, language: VideoTitleLanguage = 'en') {
  if (language === 'en' && video.titleEn) {
    return video.titleEn;
  }
  return video.title || '';
}

export function getCanonicalVideoTitle(video: VideoTitleSource) {
  return video.titleEn || video.title || '';
}
