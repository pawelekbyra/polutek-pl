import React from "react";
import ExperimentFourTopbarFix from "./ExperimentFourTopbarFix";

export default function Eksperyment4Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ExperimentFourTopbarFix />
      {children}
    </>
  );
}
