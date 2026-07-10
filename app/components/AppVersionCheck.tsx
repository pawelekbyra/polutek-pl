'use client';

import { useEffect } from 'react';
import { createScopedLogger } from '@/lib/logger';

const logger = createScopedLogger('APP_VERSION_CHECK');

export function AppVersionCheck() {
  useEffect(() => {
    const buildId = document.documentElement.getAttribute('data-build-id');
    if (!buildId) {
      logger.warn('No build ID found on root element');
      return;
    }

    const checkInterval = setInterval(async () => {
      try {
        const res = await fetch('/api/__version', {
          method: 'GET',
          headers: { 'Cache-Control': 'no-cache' },
        });

        if (!res.ok) {
          logger.warn('Version check failed', { status: res.status });
          return;
        }

        const data = await res.json();
        const remoteBuildId = data.buildId;

        if (remoteBuildId && remoteBuildId !== buildId) {
          logger.info('New version detected, reloading app', {
            oldBuildId: buildId,
            newBuildId: remoteBuildId,
          });

          // Hard reload to get fresh JavaScript, CSS, HTML
          window.location.href = window.location.href;
        }
      } catch (error) {
        // Silently fail — network errors shouldn't break the app
        logger.debug('Version check request failed', error instanceof Error ? error.message : String(error));
      }
    }, 60000); // Check every 60 seconds

    return () => clearInterval(checkInterval);
  }, []);

  return null;
}
