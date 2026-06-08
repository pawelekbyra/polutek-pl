export function isAllowedYouTubeUrl(url: URL) {
    const hostname = url.hostname.toLowerCase();
    const pathname = url.pathname.replace(/\/+$|^$/g, '') || '/';

    if (hostname === 'youtu.be') {
        return /^\/[A-Za-z0-9_-]+$/.test(pathname);
    }

    if (!['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com'].includes(hostname)) {
        return false;
    }

    if (pathname === '/watch') {
        return !!url.searchParams.get('v');
    }

    return /^\/(shorts|live|embed)\/[A-Za-z0-9_-]+$/.test(pathname);
}

export function isAllowedVimeoUrl(url: URL) {
    const hostname = url.hostname.toLowerCase();
    const pathname = url.pathname.replace(/\/+$|^$/g, '') || '/';

    if (hostname === 'vimeo.com') {
        // vimeo.com/12345 or vimeo.com/channels/staffpicks/12345
        return /^\/\d+$/.test(pathname) || /^\/channels\/[A-Za-z0-9_-]+\/\d+$/.test(pathname);
    }

    if (hostname === 'player.vimeo.com') {
        return /^\/video\/\d+$/.test(pathname);
    }

    return false;
}

export function isHlsManifest(url: string) {
    return url.toLowerCase().includes('.m3u8');
}

export function isDashManifest(url: string) {
    return url.toLowerCase().includes('.mpd');
}
