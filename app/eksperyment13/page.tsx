import { Metadata } from "next";
import ExperimentHomePage from "../_experiments/ExperimentHomePage";
import ExperimentThirteenSkin from "./ExperimentThirteenSkin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Eksperyment 13 — tactile app · Polutek",
  description: "Polutek jako bardziej aplikacyjny, dotykowy UI z mobile-first mikrointerakcjami.",
};

export default async function Eksperyment13Page(props: { searchParams: Promise<{ v?: string; q?: string }> }) {
  return ExperimentHomePage({
    Skin: ExperimentThirteenSkin,
    searchParams: props.searchParams,
    loggerPrefix: "EXPERIMENT13",
  });
}
