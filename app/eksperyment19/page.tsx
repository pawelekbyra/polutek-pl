import { Metadata } from "next";
import ExperimentHomePage from "../_experiments/ExperimentHomePage";
import ExperimentNineteenSkin from "./ExperimentNineteenSkin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Eksperyment 19 — rough notation paper · Polutek",
  description: "Papierowe tło z zakreśleniami i adnotacjami w stylu rough-notation — amber highlights, cienkopis, ciepły krem.",
};

export default async function Eksperyment19Page(props: { searchParams: Promise<{ v?: string; q?: string }> }) {
  return ExperimentHomePage({
    Skin: ExperimentNineteenSkin,
    searchParams: props.searchParams,
    loggerPrefix: "EXPERIMENT19",
  });
}
