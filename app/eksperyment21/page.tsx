import { Metadata } from "next";
import ExperimentHomePage from "../_experiments/ExperimentHomePage";
import ExperimentTwentyOneSkin from "./ExperimentTwentyOneSkin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Eksperyment 21 — sketch cards amber · Polutek",
  description: "Szkicowe karty z zaokrąglonymi narożnikami, amber i niebieskim akcentem — papier + cienkopis w wersji kartotekowej.",
};

export default async function Eksperyment21Page(props: { searchParams: Promise<{ v?: string; q?: string }> }) {
  return ExperimentHomePage({
    Skin: ExperimentTwentyOneSkin,
    searchParams: props.searchParams,
    loggerPrefix: "EXPERIMENT21",
  });
}
