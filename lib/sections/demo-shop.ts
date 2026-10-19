import { demoProductArt, type ArtPalette, type ProductShape } from "./demo-art";

/** DEMO data of the Shop prototype (no database, no payments): Polish and English texts, other UI languages use English. */
export type ShopCategory = "clothing" | "accessories" | "home";

export type DemoProduct = {
  id: string;
  category: ShopCategory;
  name: { pl: string; en: string };
  description: { pl: string; en: string };
  /** Price in PLN (whole zlotys). */
  price: number;
  badge: "new" | "bestseller" | null;
  sizes: string[] | null;
  image: string;
};

export const SHOP_CATEGORIES: readonly ShopCategory[] = ["clothing", "accessories", "home"];

const make = (
  id: string,
  category: ShopCategory,
  shape: ProductShape,
  palette: ArtPalette,
  price: number,
  badge: DemoProduct["badge"],
  sizes: string[] | null,
  name: DemoProduct["name"],
  description: DemoProduct["description"],
): DemoProduct => ({ id, category, name, description, price, badge, sizes, image: demoProductArt(shape, palette) });

const SIZES = ["S", "M", "L", "XL"];

export const DEMO_PRODUCTS: readonly DemoProduct[] = [
  make("tee-blue", "clothing", "tee", ["#dbeafe", "#2563eb", "#1e3a8a"], 89, "new", SIZES,
    { pl: "Koszulka Classic", en: "Classic Tee" },
    { pl: "Miękka koszulka z bawełny organicznej, krój regular. Wersja demonstracyjna.", en: "Soft organic cotton tee, regular fit. Demo version." }),
  make("tee-amber", "clothing", "tee", ["#fef3c7", "#f59e0b", "#78350f"], 89, null, SIZES,
    { pl: "Koszulka Sunset", en: "Sunset Tee" },
    { pl: "Ciepły, słoneczny kolor na każdy dzień. Wersja demonstracyjna.", en: "A warm, sunny color for every day. Demo version." }),
  make("tee-green", "clothing", "tee", ["#dcfce7", "#16a34a", "#14532d"], 95, "bestseller", SIZES,
    { pl: "Koszulka Forest", en: "Forest Tee" },
    { pl: "Gładka, oddychająca, chętnie wybierana przez widzów. Wersja demonstracyjna.", en: "Smooth, breathable, a viewers' favorite. Demo version." }),
  make("cap-black", "clothing", "cap", ["#e5e7eb", "#374151", "#111827"], 69, null, null,
    { pl: "Czapka z daszkiem", en: "Baseball Cap" },
    { pl: "Regulowany pasek, haftowane logo. Wersja demonstracyjna.", en: "Adjustable strap, embroidered logo. Demo version." }),
  make("mug-white", "home", "mug", ["#e0f2fe", "#0ea5e9", "#0c4a6e"], 39, "bestseller", null,
    { pl: "Kubek 330 ml", en: "Mug 330 ml" },
    { pl: "Ceramiczny kubek, bezpieczny do zmywarki. Wersja demonstracyjna.", en: "Ceramic mug, dishwasher safe. Demo version." }),
  make("mug-rose", "home", "mug", ["#ffe4e6", "#e11d48", "#881337"], 39, "new", null,
    { pl: "Kubek Rose", en: "Rose Mug" },
    { pl: "Różowy kubek na poranną kawę. Wersja demonstracyjna.", en: "A pink mug for the morning coffee. Demo version." }),
  make("poster-a3", "home", "poster", ["#ede9fe", "#7c3aed", "#2e1065"], 49, null, null,
    { pl: "Plakat A3", en: "Poster A3" },
    { pl: "Wydruk na matowym papierze, 297 × 420 mm. Wersja demonstracyjna.", en: "Matte paper print, 297 × 420 mm. Demo version." }),
  make("notebook", "home", "notebook", ["#ffedd5", "#ea580c", "#431407"], 35, null, null,
    { pl: "Notes w linie", en: "Lined Notebook" },
    { pl: "A5, 96 kartek, twarda oprawa. Wersja demonstracyjna.", en: "A5, 96 pages, hardcover. Demo version." }),
  make("tote", "accessories", "tote", ["#ecfccb", "#65a30d", "#1a2e05"], 59, "new", null,
    { pl: "Torba bawełniana", en: "Cotton Tote" },
    { pl: "Pojemna, lekka, na zakupy i do szkoły. Wersja demonstracyjna.", en: "Roomy and light, for shopping and school. Demo version." }),
  make("sticker-pack", "accessories", "sticker", ["#cffafe", "#06b6d4", "#164e63"], 19, null, null,
    { pl: "Zestaw naklejek", en: "Sticker Pack" },
    { pl: "Pięć wodoodpornych naklejek. Wersja demonstracyjna.", en: "Five waterproof stickers. Demo version." }),
  make("sticker-big", "accessories", "sticker", ["#fce7f3", "#ec4899", "#500724"], 12, null, null,
    { pl: "Naklejka XL", en: "Sticker XL" },
    { pl: "Duża naklejka na laptopa. Wersja demonstracyjna.", en: "A large laptop sticker. Demo version." }),
  make("tote-night", "accessories", "tote", ["#e0e7ff", "#4f46e5", "#1e1b4b"], 65, "bestseller", null,
    { pl: "Torba Night", en: "Night Tote" },
    { pl: "Granatowa torba z mocnymi uchwytami. Wersja demonstracyjna.", en: "A navy tote with sturdy handles. Demo version." }),
];

export type CartLine = { productId: string; size: string | null; qty: number };

/** Adds a line to the demo cart, merging with the same product and size. */
export function addToCart(lines: readonly CartLine[], line: CartLine): CartLine[] {
  const found = lines.find((l) => l.productId === line.productId && l.size === line.size);
  if (!found) return [...lines, line];
  return lines.map((l) => (l === found ? { ...l, qty: Math.min(99, l.qty + line.qty) } : l));
}
