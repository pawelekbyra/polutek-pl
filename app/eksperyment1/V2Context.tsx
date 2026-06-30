"use client";

import React, { createContext, useContext } from "react";

const V2Context = createContext(false);

export function V2Provider({ children }: { children: React.ReactNode }) {
  return <V2Context.Provider value={true}>{children}</V2Context.Provider>;
}

export function useIsV2() {
  return useContext(V2Context);
}
