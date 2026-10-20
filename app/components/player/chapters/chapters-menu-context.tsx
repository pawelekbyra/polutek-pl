"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

/** Whether the chapters panel is open. Shared by the chapter label next to the time and the panel's own button. */
interface ChaptersMenuState {
  open: boolean;
  setOpen: (open: boolean | ((open: boolean) => boolean)) => void;
}

const ChaptersMenuContext = createContext<ChaptersMenuState | null>(null);

export function ChaptersMenuProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const value = useMemo(() => ({ open, setOpen }), [open]);
  return <ChaptersMenuContext.Provider value={value}>{children}</ChaptersMenuContext.Provider>;
}

export function useChaptersMenu(): ChaptersMenuState {
  return useContext(ChaptersMenuContext) ?? { open: false, setOpen: () => undefined };
}
