import { Metadata } from "next";
import ExperimentHomePage from "../_experiments/ExperimentHomePage";
import ExperimentElevenSkin from "./ExperimentElevenSkin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Eksperyment 11 — wired prototype · Polutek",
  description: "Polutek jako szybki test klimatu wired-elements i szkicowych web components.",
};

export default async function Eksperyment11Page(props: { searchParams: Promise<{ v?: string; q?: string }> }) {
  return ExperimentHomePage({
    Skin: ExperimentElevenSkin,
    searchParams: props.searchParams,
    loggerPrefix: "EXPERIMENT11",
  });
}
