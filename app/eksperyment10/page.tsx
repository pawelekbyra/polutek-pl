import { Metadata } from "next";
import ExperimentHomePage from "../_experiments/ExperimentHomePage";
import ExperimentTenSkin from "./ExperimentTenSkin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Eksperyment 10 — notation marks · Polutek",
  description: "Polutek jako test rough-notation, zakreśleń i własnych adnotacji SVG.",
};

export default async function Eksperyment10Page(props: { searchParams: Promise<{ v?: string; q?: string }> }) {
  return ExperimentHomePage({
    Skin: ExperimentTenSkin,
    searchParams: props.searchParams,
    loggerPrefix: "EXPERIMENT10",
  });
}
