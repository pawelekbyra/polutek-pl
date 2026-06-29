import { Metadata } from "next";
import ExperimentHomePage from "../_experiments/ExperimentHomePage";
import ExperimentTwentySkin from "./ExperimentTwentySkin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Eksperyment 20 — thin pen clean · Polutek",
  description: "Papier i cienkopis — czyste linie, zaokrąglone ramki, przyciski pillowe, sans-serif systemowy.",
};

export default async function Eksperyment20Page(props: { searchParams: Promise<{ v?: string; q?: string }> }) {
  return ExperimentHomePage({
    Skin: ExperimentTwentySkin,
    searchParams: props.searchParams,
    loggerPrefix: "EXPERIMENT20",
  });
}
