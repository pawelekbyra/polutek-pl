import { Metadata } from "next";
import ExperimentHomePage from "../_experiments/ExperimentHomePage";
import ExperimentFourteenSkin from "./ExperimentFourteenSkin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Eksperyment 14 — soft poster paper · Polutek",
  description: "Polutek jako spokojne połączenie papierowego szkicu z eksperymentu 4 i geometrii eksperymentu 7, bez czerwieni.",
};

export default async function Eksperyment14Page(props: { searchParams: Promise<{ v?: string; q?: string }> }) {
  return ExperimentHomePage({
    Skin: ExperimentFourteenSkin,
    searchParams: props.searchParams,
    loggerPrefix: "EXPERIMENT14",
  });
}
