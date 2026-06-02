export type VideoTitleLanguage = 'pl' | 'en' | string;

type VideoTitleSource = {
  slug?: string | null;
  title?: string | null;
  tier?: string | null;
};

type VideoTitleOverride = {
  matches: (video: VideoTitleSource) => boolean;
  titles: {
    pl: string;
    en: string;
  };
};

const normalized = (value?: string | null) => value?.toLowerCase().trim() || '';

const isPublicPlaceholderVideo = (video: VideoTitleSource) => {
  const slug = normalized(video.slug);
  const title = normalized(video.title);

  return slug === 'wuthering-heights-cover'
    || slug === 'independency-2024'
    || title.includes('wuthering heights')
    || title.includes('wuthering-heights')
    || title.includes('nie masz psychy')
    || title.includes("you don't have")
    || title.includes('you dont have');
};

const isLoggedInPlaceholderVideo = (video: VideoTitleSource) => {
  const slug = normalized(video.slug);
  const title = normalized(video.title);

  return slug === 'historia-powstania-osady'
    || title.includes('historia powstania osady')
    || title.includes('secret project');
};

const isPatronPlaceholderVideo = (video: VideoTitleSource) => {
  const slug = normalized(video.slug);
  const title = normalized(video.title);

  return slug === 'intencja-swiadomosc-sprawczosci'
    || title.includes('intencja')
    || title.includes('świadomość')
    || title.includes('swiadomosc')
    || title.includes('udało się')
    || title.includes('udalo sie');
};

export const VIDEO_TITLE_OVERRIDES: VideoTitleOverride[] = [
  {
    matches: isPublicPlaceholderVideo,
    titles: {
      pl: 'Nie masz psychy się zalogować',
      en: "You don't have the guts to log in",
    },
  },
  {
    matches: isLoggedInPlaceholderVideo,
    titles: {
      pl: 'Secret Project',
      en: 'Secret Project',
    },
  },
  {
    matches: isPatronPlaceholderVideo,
    titles: {
      pl: 'Udało się!!!',
      en: 'Udało się!!!',
    },
  },
];

export function getVideoDisplayTitle(video: VideoTitleSource, language: VideoTitleLanguage = 'en') {
  const override = VIDEO_TITLE_OVERRIDES.find(({ matches }) => matches(video));

  if (override) {
    return language === 'pl' ? override.titles.pl : override.titles.en;
  }

  return video.title || '';
}

export function getCanonicalVideoTitle(video: VideoTitleSource) {
  return getVideoDisplayTitle(video, 'en');
}
