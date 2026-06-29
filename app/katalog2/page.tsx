import { Metadata } from "next";
import { Caveat, Patrick_Hand, Schoolbell, Dancing_Script } from "next/font/google";
import KatalogClient from "./KatalogClient";

export const metadata: Metadata = {
  title: "Katalog Technik — Polutek",
  description: "Interaktywny katalog technik rysunkowych: RoughJS, Perfect Freehand, Rough Notation, Wired Elements, czcionki odręczne.",
};

const caveat = Caveat({ subsets: ["latin", "latin-ext"], variable: "--font-caveat", display: "swap" });
const patrickHand = Patrick_Hand({ subsets: ["latin"], weight: "400", variable: "--font-patrick", display: "swap" });
const schoolbell = Schoolbell({ subsets: ["latin"], weight: "400", variable: "--font-schoolbell", display: "swap" });
const dancingScript = Dancing_Script({ subsets: ["latin", "latin-ext"], variable: "--font-dancing", display: "swap" });

export default function Katalog2Page() {
  return (
    <>
      <style>{`
        @font-face {
          font-family: 'Virgil';
          src: url('https://cdn.jsdelivr.net/gh/excalidraw/virgil@latest/Virgil.woff2') format('woff2');
          font-display: swap;
        }
      `}</style>
      <div
        className={`${caveat.variable} ${patrickHand.variable} ${schoolbell.variable} ${dancingScript.variable}`}
      >
        <KatalogClient />
      </div>
    </>
  );
}
