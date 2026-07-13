"use client";

import React, { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

function buildGlassHref(videoId: string) {
  const params = new URLSearchParams(window.location.search);
  params.set("v", videoId);
  return `/glass?${params.toString()}`;
}

function getVideoIdFromHomeHref(href: string) {
  const url = new URL(href, window.location.href);
  const isLocalizedHome = /^\/(?:pl|en)\/?$/.test(url.pathname);
  const isGlassPage = url.pathname === "/glass";
  if (!isLocalizedHome && !isGlassPage) return null;
  return url.searchParams.get("v");
}

export default function GlassNavigationBridge({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);

  const rewriteVideoLinks = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;

    root.querySelectorAll<HTMLAnchorElement>('a[href*="?v="]').forEach((anchor) => {
      const videoId = getVideoIdFromHomeHref(anchor.href);
      if (!videoId) return;
      const nextHref = buildGlassHref(videoId);
      if (anchor.getAttribute("href") !== nextHref) {
        anchor.setAttribute("href", nextHref);
      }
    });
  }, []);

  useEffect(() => {
    rewriteVideoLinks();
    const root = rootRef.current;
    if (!root) return;

    const observer = new MutationObserver(rewriteVideoLinks);
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["href"] });
    return () => observer.disconnect();
  }, [rewriteVideoLinks]);

  const handleClickCapture = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const target = event.target;
    if (!(target instanceof Element)) return;
    const anchor = target.closest<HTMLAnchorElement>('a[href*="?v="]');
    if (!anchor || !rootRef.current?.contains(anchor)) return;

    const videoId = getVideoIdFromHomeHref(anchor.href);
    if (!videoId) return;

    event.preventDefault();
    router.replace(buildGlassHref(videoId), { scroll: false });
  };

  return (
    <div ref={rootRef} onClickCapture={handleClickCapture}>
      {children}
    </div>
  );
}
