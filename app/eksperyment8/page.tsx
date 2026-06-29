import { Metadata } from "next";
import ExperimentHomePage from "../_experiments/ExperimentHomePage";
import ExperimentEightSkin from "./ExperimentEightSkin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Eksperyment 8 — rough paper system · Polutek",
  description: "Polutek jako test papierowego systemu ramek i obrysów generowanych przez roughjs.",
};

export default async function Eksperyment8Page(props: { searchParams: Promise<{ v?: string; q?: string }> }) {
  return ExperimentHomePage({
    Skin: ExperimentEightSkin,
    searchParams: props.searchParams,
    loggerPrefix: "EXPERIMENT8",
  });
}
