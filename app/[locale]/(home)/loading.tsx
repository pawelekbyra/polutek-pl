import { SitePreloaderScreen } from "@/app/components/preload/SitePreloaderScreen";

/**
 * Same full-screen preloader PageRevealGate keeps on top of the page after it
 * streams in, so "server still rendering" and "page settling on the client" read
 * as one continuous screen instead of a skeleton that swaps into another state.
 */
export default function LocalizedHomeLoading() {
  return <SitePreloaderScreen />;
}
