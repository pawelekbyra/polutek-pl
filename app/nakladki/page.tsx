import type { Metadata } from "next";
import NakladkiGallery from "./NakladkiGallery";

export const metadata: Metadata = {
  title: "Nakładki — galeria koncepcji | Polutek.pl",
  robots: { index: false, follow: false },
};

export default function NakladkiPage() {
  return <NakladkiGallery />;
}
