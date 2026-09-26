import { HomeRouteLoading } from "@/app/components/preload/HomeRouteLoading";

/**
 * First load: the full-screen SitePreloaderScreen (continuous with PageRevealGate).
 * In-session navigations: a layout skeleton — see HomeRouteLoading.
 */
export default function LocalizedHomeLoading() {
  return <HomeRouteLoading />;
}
