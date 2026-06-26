export type VideoSourceKind = 'direct' | 'hls' | 'dash' | 'youtube' | 'vimeo' | 'unknown';

export type VideoSourceInfo = {
  kind: VideoSourceKind;
  label: string;
  playbackUrl: string;
  embedUrl?: string;
  needsProxy: boolean;
};

const DIRECT_VIDEO_EXTENSIONS = ['.mp4', '.webm', '.ogg', '.ogv', '.mov', '.m4v'];

function normalizeYouTubeId(url: URL) {
  const host = url.hostname.replace(/^www\./, '').toLowerCase();
  if (host === 'youtu.be') return url.pathname.split('/').filter(Boolean)[0] || null;
  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
    if (url.pathname === '/watch') return url.searchParams.get('v');
    const parts = url.pathname.split('/').filter(Boolean);
    if (['embed', 'shorts', 'live'].includes(parts[0])) return parts[1] || null;
  }
  return null;
}

function normalizeVimeoId(url: URL) {
  const host = url.hostname.replace(/^www\./, '').toLowerCase();
  if (!['vimeo.com', 'player.vimeo.com'].includes(host)) return null;
  const parts = url.pathname.split('/').filter(Boolean);
  if (host === 'player.vimeo.com' && parts[0] === 'video') return parts[1] || null;
  return parts.find((part) => /^\d+$/.test(part)) || null;
}

export function getVideoSourceInfo(rawUrl: string, proxiedUrl?: string): VideoSourceInfo {
  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    return {
      kind: 'unknown',
      label: 'Nieznane źródło',
      playbackUrl: proxiedUrl || rawUrl,
      needsProxy: false,
    };
  }

  const youtubeId = normalizeYouTubeId(url);
  if (youtubeId) {
    return {
      kind: 'youtube',
      label: 'YouTube',
      playbackUrl: rawUrl,
      embedUrl: `https://www.youtube-nocookie.com/embed/${youtubeId}`,
      needsProxy: false,
    };
  }

  const vimeoId = normalizeVimeoId(url);
  if (vimeoId) {
    return {
      kind: 'vimeo',
      label: 'Vimeo',
      playbackUrl: rawUrl,
      embedUrl: `https://player.vimeo.com/video/${vimeoId}`,
      needsProxy: false,
    };
  }

  const pathname = url.pathname.toLowerCase();
  // HLS/DASH manifests are allowed from explicitly configured media hosts.
  // Access is checked before this URL is returned to the player.
  if (pathname.endsWith('.m3u8')) {
    return {
      kind: 'hls',
      label: 'HLS (.m3u8)',
      playbackUrl: proxiedUrl || rawUrl,
      needsProxy: !!proxiedUrl,
    };
  }

  if (pathname.endsWith('.mpd')) {
    return {
      kind: 'dash',
      label: 'MPEG-DASH (.mpd)',
      playbackUrl: proxiedUrl || rawUrl,
      needsProxy: !!proxiedUrl,
    };
  }

  if (DIRECT_VIDEO_EXTENSIONS.some((extension) => pathname.endsWith(extension))) {
    return {
      kind: 'direct',
      label: 'Plik wideo',
      playbackUrl: proxiedUrl || rawUrl,
      needsProxy: !!proxiedUrl,
    };
  }

  return {
    kind: 'direct',
    label: 'Adres URL wideo',
    playbackUrl: proxiedUrl || rawUrl,
    needsProxy: !!proxiedUrl,
  };
}

export const SUPPORTED_VIDEO_SOURCES = [
  'YouTube: youtube.com/watch, youtu.be, /shorts, /live oraz /embed',
  'Vimeo: vimeo.com oraz player.vimeo.com',
  'HLS: playlisty .m3u8 (najlepiej publiczne URL-e z CORS)',
  'MPEG-DASH: manifesty .mpd (wymagają Video.js)',
  'Pliki bezpośrednie: .mp4, .webm, .ogg/.ogv, .mov, .m4v z R2/S3/Vercel Blob lub hostów z ALLOWED_MEDIA_HOSTS',
];
