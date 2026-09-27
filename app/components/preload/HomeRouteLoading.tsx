import { SitePreloaderScreen } from "./SitePreloaderScreen";

/**
 * Loading state of the home route — always the full-screen preloader,
 * both on first load and in-session navigations (e.g. logo click).
 */
export function HomeRouteLoading() {
  return <SitePreloaderScreen />;
}
