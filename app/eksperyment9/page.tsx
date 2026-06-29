import { Metadata } from "next";
import ExperimentHomePage from "../_experiments/ExperimentHomePage";
import ExperimentNineSkin from "./ExperimentNineSkin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Eksperyment 9 — freehand organic · Polutek",
  description: "Polutek jako test bardziej organicznej kreski z perfect-freehand i własnymi pathami SVG.",
};

export default async function Eksperyment9Page(props: { searchParams: Promise<{ v?: string; q?: string }> }) {
  return ExperimentHomePage({
    Skin: ExperimentNineSkin,
    searchParams: props.searchParams,
    loggerPrefix: "EXPERIMENT9",
  });
}
