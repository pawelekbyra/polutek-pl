"use client";

import { useState } from "react";
import { HomePageSkeleton } from "@/components/skeletons";
import { SitePreloaderScreen } from "./SitePreloaderScreen";
import { hasRevealedPageInThisDocument } from "./PageRevealGate";

/**
 * Loading state of the home route.
 *
 * First load of the document: the same full-screen preloader PageRevealGate keeps
 * over the page, so streaming and client settling read as one continuous screen.
 * Later in-app navigations back to the home page (from legal pages, search, a
 * language switch): a layout skeleton instead, so the branded full-screen
 * preloader never re-appears mid-session. Server rendering always takes the first
 * branch, and so does hydration of a first load, so the two always match.
 */
export function HomeRouteLoading() {
  const [inSession] = useState(() => hasRevealedPageInThisDocument());
  if (inSession) {
    return (
      <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
        <HomePageSkeleton />
      </div>
    );
  }
  return <SitePreloaderScreen />;
}
