"use client";

import { useState } from 'react';
import { useClientReady } from './useClientEnvironment';

interface ShareData {
  title: string;
  text?: string;
  url: string;
}

export type NativeShareResult =
  | "shared"
  | "cancelled"
  | "failed"
  | "unsupported";

export function useShare() {
  const clientReady = useClientReady();
  const [copied, setCopied] = useState(false);
  const isMobile =
    clientReady && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  const canNativeShare = clientReady && typeof navigator.share === 'function';

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
        return "shared" as const;
      } catch (err) {
        if ((err as Error).name === 'AbortError') return "cancelled" as const;
        console.error('Share failed:', err);
        return "failed" as const;
      }
    }
    return "unsupported" as const;
  };

  return { isMobile, canNativeShare, share, copied, copyToClipboard };
}
