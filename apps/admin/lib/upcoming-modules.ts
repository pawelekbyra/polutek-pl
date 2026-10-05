/**
 * Honest "coming in phase N" pages for modules that are not built yet (no mock data, no dead filters).
 * Scope lines follow docs/architecture/admin-panel.md section 3 (MUST at launch) and section 4 (phases).
 */
export type UpcomingModule = {
  id: string;
  title: string;
  phase: 2 | 3 | 4;
  summary: string;
  scope: string[];
  /** Where the owner does this today (old panel on www), if anywhere. */
  today?: { label: string; path: string }[];
};

/** Every module of the panel is built; kept as the fallback shape for a future module that is announced before it ships. */
export const UPCOMING_MODULES: Record<string, UpcomingModule> = {
};
