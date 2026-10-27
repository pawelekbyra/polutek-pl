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
  // Polish keeps the original; every other interface language shows the English text (the content
  // exists in Polish and English only, docs/operations/I18N.md).
  if (language !== 'pl' && video.titleEn) {
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
  if (language !== 'pl' && video.descriptionEn) {
    return video.descriptionEn;
  }
  return video.description || '';
}

/** The search-result excerpt in the content language: English for every interface language but Polish, else the Polish one. */
export function getSearchSnippet(
  item: { snippet?: string | null; snippetEn?: string | null },
  language: VideoTitleLanguage = 'en',
) {
  if (language !== 'pl' && item.snippetEn) {
    return item.snippetEn;
  }
  return item.snippet ?? null;
}

export function getCanonicalVideoDescription(video: VideoDescriptionSource) {
  return video.description || video.descriptionEn || '';
}
