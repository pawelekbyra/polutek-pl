import { Metadata } from "next";
import ExperimentHomePage from "../_experiments/ExperimentHomePage";
import ExperimentSeventeenSkin from "./ExperimentSeventeenSkin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Eksperyment 17 — spokojny szkic · Polutek",
  description: "Strona główna Polutek w spokojniejszej, kratkowanej stylizacji inspirowanej eksperymentem 4.",
};

export default async function Eksperyment17Page(props: { searchParams: Promise<{ v?: string; q?: string }> }) {
  return ExperimentHomePage({
    Skin: ExperimentSeventeenSkin,
    searchParams: props.searchParams,
    loggerPrefix: "EXPERIMENT17",
  });
}
