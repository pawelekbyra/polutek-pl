import { Metadata } from "next";
import ExperimentHomePage from "../_experiments/ExperimentHomePage";
import ExperimentFifteenSkin from "./ExperimentFifteenSkin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Eksperyment 15 — quiet gallery blocks · Polutek",
  description: "Polutek jako jeszcze spokojniejsza galeryjna wersja połączenia eksperymentów 4 i 7, bez czerwieni i bez krzykliwych akcentów.",
};

export default async function Eksperyment15Page(props: { searchParams: Promise<{ v?: string; q?: string }> }) {
  return ExperimentHomePage({
    Skin: ExperimentFifteenSkin,
    searchParams: props.searchParams,
    loggerPrefix: "EXPERIMENT15",
  });
}
