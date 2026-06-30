import { Plus_Jakarta_Sans, Outfit, Space_Grotesk, Bebas_Neue, Kalam, Patrick_Hand, Caveat } from "next/font/google";

export const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-jakarta",
  display: "swap",
});

export const outfit = Outfit({
  subsets: ["latin", "latin-ext"],
  variable: "--font-outfit",
  display: "swap",
});

export const spaceGrotesk = Space_Grotesk({
  subsets: ["latin", "latin-ext"],
  variable: "--font-space-grotesk",
  display: "swap",
});

export const bebasNeue = Bebas_Neue({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-brand",
  display: "swap",
});

export const kalam = Kalam({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "700"],
  variable: "--font-najs",
  display: "swap",
});

export const patrickHand = Patrick_Hand({
  subsets: ["latin", "latin-ext"],
  weight: "400",
  variable: "--font-patrick",
  display: "swap",
});

export const caveat = Caveat({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-caveat",
  display: "swap",
});
