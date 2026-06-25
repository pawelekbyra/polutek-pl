export type VideoTitleLanguage = 'pl' | 'en' | string;

type VideoTitleSource = {
  slug?: string | null;
  title?: string | null;
  titleEn?: string | null;
  tier?: string | null;
};

type VideoDescriptionSource = {
  description?: string | null;
  descriptionEn?: string | null;
};

/**
 * Legacy overrides removed to ensure database titles are always respected.
 * If you need to translate titles, consider adding a translation table to the DB.
 */
export function getVideoDisplayTitle(video: VideoTitleSource, language: VideoTitleLanguage = 'en') {
  if (language === 'en' && video.titleEn) {
    return video.titleEn;
  }
  return video.title || '';
}

export function getCanonicalVideoTitle(video: VideoTitleSource) {
  return video.title || video.titleEn || '';
}

export function getVideoDisplayDescription(
  video: VideoDescriptionSource,
  language: VideoTitleLanguage = 'en',
) {
  if (language === 'en' && video.descriptionEn) {
    return video.descriptionEn;
  }

  return video.description || '';
}

export function getCanonicalVideoDescription(video: VideoDescriptionSource) {
  return video.description || video.descriptionEn || '';
}
