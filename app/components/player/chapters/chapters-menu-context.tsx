"use client";

import { createContext, useContext, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from "react";

/** Whether the chapters panel is open. Shared by the panel's own button and the settings menu's "Chapters" entry. */
interface ChaptersMenuState {
  open: boolean;
  setOpen: (open: boolean | ((open: boolean) => boolean)) => void;
  /** The control that opened the panel when it was not the panel's own button (the settings menu's "Chapters" entry); focus returns there on close. */
  opener: MutableRefObject<HTMLElement | null>;
}

const ChaptersMenuContext = createContext<ChaptersMenuState | null>(null);

export function ChaptersMenuProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLElement | null>(null);
  const value = useMemo(() => ({ open, setOpen, opener }), [open]);
  return <ChaptersMenuContext.Provider value={value}>{children}</ChaptersMenuContext.Provider>;
}

export function useChaptersMenu(): ChaptersMenuState {
  return useContext(ChaptersMenuContext) ?? { open: false, setOpen: () => undefined, opener: { current: null } };
}
