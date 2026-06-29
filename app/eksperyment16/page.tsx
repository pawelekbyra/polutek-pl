import { Metadata } from "next";
import ExperimentHomePage from "../_experiments/ExperimentHomePage";
import ExperimentSixteenSkin from "./ExperimentSixteenSkin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Eksperyment 16 — bauhaus bez czerwieni · Polutek",
  description: "Strona główna Polutek w geometrycznej, blokowej stylizacji bez czerwieni i bez nieruchomego tła.",
};

export default async function Eksperyment16Page(props: { searchParams: Promise<{ v?: string; q?: string }> }) {
  return ExperimentHomePage({
    Skin: ExperimentSixteenSkin,
    searchParams: props.searchParams,
    loggerPrefix: "EXPERIMENT16",
  });
}
