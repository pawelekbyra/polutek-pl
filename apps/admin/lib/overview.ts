import { createOverviewDeps, type OverviewDeps } from "@/lib/modules/admin-overview";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { isDevFixturesEnabled } from "./config";
import { devFixtureDeps } from "./dev-fixtures";

/**
 * Data source of the screens. Production always reads the real database and probes. Only `next dev`
 * with ADMIN_DEV_FIXTURES=1 swaps in labelled sample data (the top bar then shows "Dane przykładowe").
 */
export function overviewDeps(): OverviewDeps {
  if (isDevFixturesEnabled()) return devFixtureDeps();
  return createOverviewDeps(createAppContext({ type: "system", reason: "admin_panel_read" }));
}

export function usesSampleData(): boolean {
  return isDevFixturesEnabled();
}
