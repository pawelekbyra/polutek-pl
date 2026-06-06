"use client";

import { useState, useEffect } from 'react';

interface ShareData {
  title: string;
  text?: string;
  url: string;
}

export function useShare() {
  const [isMobile, setIsMobile] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    const mobile = /Mobi|Android|iPhone|iPad/i.test(ua);
    setIsMobile(mobile);
    setCanNativeShare(typeof navigator.share === 'function');
  }, []);

  const copyToClipboard = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      return true;
    } catch (err) {
      console.error('Failed to copy: ', err);
      return false;
    }
  };

  const share = async (data: ShareData) => {
    if (isMobile && canNativeShare) {
      try {
        await navigator.share(data);
        return true;
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('Share failed:', err);
        }
        return false;
      }
    }
    return false;
  };

  return { isMobile, canNativeShare, share, copied, copyToClipboard };
}
