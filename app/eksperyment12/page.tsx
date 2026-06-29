import { Metadata } from "next";
import ExperimentHomePage from "../_experiments/ExperimentHomePage";
import ExperimentTwelveSkin from "./ExperimentTwelveSkin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Eksperyment 12 — blueprint SVG · Polutek",
  description: "Polutek jako chłodny blueprint z własnymi pathami SVG, siatką i technicznymi adnotacjami.",
};

export default async function Eksperyment12Page(props: { searchParams: Promise<{ v?: string; q?: string }> }) {
  return ExperimentHomePage({
    Skin: ExperimentTwelveSkin,
    searchParams: props.searchParams,
    loggerPrefix: "EXPERIMENT12",
  });
}
