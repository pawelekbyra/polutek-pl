import { Metadata } from "next";
import ExperimentHomePage from "../_experiments/ExperimentHomePage";
import ExperimentEighteenSkin from "./ExperimentEighteenSkin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Eksperyment 18 — bauhaus scroll background · Polutek",
  description: "Wariant eksperymentu 7 z nieruchomym topbarem i tłem przesuwającym się razem ze scrollowaniem.",
};

export default async function Eksperyment18Page(props: { searchParams: Promise<{ v?: string; q?: string }> }) {
  return ExperimentHomePage({
    Skin: ExperimentEighteenSkin,
    searchParams: props.searchParams,
    loggerPrefix: "EXPERIMENT18",
  });
}
