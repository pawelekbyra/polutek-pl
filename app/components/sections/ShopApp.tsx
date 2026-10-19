"use client";

import { useMemo, useState } from "react";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useLanguage } from "@/app/components/LanguageContext";
import { intlLocale } from "@/lib/i18n/ui";
import { DEMO_PRODUCTS, SHOP_CATEGORIES, addToCart, type CartLine, type DemoProduct, type ShopCategory } from "@/lib/sections/demo-shop";
import SectionDialog from "./SectionDialog";
import { PrototypeBadge } from "./PhotosFeed";

/** Prototype storefront (flag SHOW_SECTION_NAV): demo products, a client-side cart, no payments and no checkout. */
export default function ShopApp() {
  const { language, tx } = useLanguage();
  const [category, setCategory] = useState<ShopCategory | "all">("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [size, setSize] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [justAdded, setJustAdded] = useState(false);

  const money = useMemo(() => new Intl.NumberFormat(intlLocale(language), { style: "currency", currency: "PLN", maximumFractionDigits: 0 }), [language]);
  const pick = (text: { pl: string; en: string }) => (language === "pl" ? text.pl : text.en);
  const categoryLabel = (c: ShopCategory | "all") =>
    c === "all" ? tx("Wszystko", "All") : c === "clothing" ? tx("Ubrania", "Clothing") : c === "accessories" ? tx("Akcesoria", "Accessories") : tx("Dom", "Home");
  const badgeLabel = (b: NonNullable<DemoProduct["badge"]>) => (b === "new" ? tx("Nowość", "New") : tx("Bestseller", "Bestseller"));

  const products = DEMO_PRODUCTS.filter((p) => category === "all" || p.category === category);
  const open = DEMO_PRODUCTS.find((p) => p.id === openId) ?? null;
  const cartCount = cart.reduce((sum, line) => sum + line.qty, 0);
  const cartTotal = cart.reduce((sum, line) => sum + line.qty * (DEMO_PRODUCTS.find((p) => p.id === line.productId)?.price ?? 0), 0);

  const openProduct = (product: DemoProduct) => {
    setOpenId(product.id);
    setSize(product.sizes ? (product.sizes[1] ?? product.sizes[0] ?? null) : null);
    setQty(1);
    setJustAdded(false);
  };

  return (
    <div className="px-4 sm:px-0">
      <header className="flex flex-wrap items-center gap-3 pb-4">
        <h1 className="font-brand text-2xl font-bold tracking-tight sm:text-3xl">{tx("Sklep", "Shop")}</h1>
        <PrototypeBadge />
        <button
          type="button"
          onClick={() => setCartOpen(true)}
          aria-label={tx("Koszyk: {0}", "Cart: {0}", cartCount)}
          className="ml-auto flex items-center gap-2 rounded-full border border-[var(--chan-line)] bg-[var(--chan-card)] px-4 py-2 text-sm font-semibold shadow-sm transition hover:bg-[var(--chan-surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--chan-blue)]"
        >
          <ShoppingBag className="h-5 w-5" aria-hidden="true" />
          <span aria-hidden="true">{cartCount}</span>
        </button>
      </header>
      <p className="mb-4 rounded-2xl bg-[var(--chan-blue-soft)] px-4 py-2 text-xs text-[var(--chan-muted-2)]">
        {tx("Prototyp: produkty są przykładowe, niczego jeszcze nie można kupić.", "Prototype: demo products, nothing can be bought yet.")}
      </p>

      <div role="group" aria-label={tx("Kategorie produktów", "Product categories")} className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {(["all", ...SHOP_CATEGORIES] as const).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            aria-pressed={category === c}
            className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--chan-blue)] ${
              category === c ? "border-[var(--chan-blue)] bg-[var(--chan-blue)] text-white" : "border-[var(--chan-line)] bg-[var(--chan-card)] text-[var(--chan-muted-2)] hover:bg-[var(--chan-surface)]"
            }`}
          >
            {categoryLabel(c)}
          </button>
        ))}
      </div>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
        {products.map((product) => (
          <li key={product.id}>
            <button
              type="button"
              onClick={() => openProduct(product)}
              className="group block w-full overflow-hidden rounded-3xl border border-[var(--chan-line)] bg-[var(--chan-card)] text-left shadow-sm transition hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--chan-blue)] motion-reduce:transition-none"
            >
              <span className="relative block aspect-square overflow-hidden bg-[var(--chan-surface)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={product.image} alt="" loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-105 motion-reduce:transition-none" />
                {product.badge ? (
                  <span className="absolute left-2 top-2 rounded-full bg-[var(--chan-amber)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--chan-amber-ink)]">
                    {badgeLabel(product.badge)}
                  </span>
                ) : null}
              </span>
              <span className="block p-3">
                <span className="block truncate text-sm font-semibold">{pick(product.name)}</span>
                <span className="mt-0.5 block text-sm text-[var(--chan-muted-2)]">{money.format(product.price)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {open ? (
        <SectionDialog label={pick(open.name)} onClose={() => setOpenId(null)}>
          <div className="grid min-h-0 flex-1 overflow-y-auto md:grid-cols-2">
            <div className="aspect-square w-full bg-[var(--chan-surface)] md:aspect-auto md:min-h-[360px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={open.image} alt={pick(open.name)} className="h-full w-full object-cover" />
            </div>
            <div className="flex flex-col gap-4 p-5">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-brand text-xl font-bold">{pick(open.name)}</h2>
                  {open.badge ? <span className="rounded-full bg-[var(--chan-amber)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--chan-amber-ink)]">{badgeLabel(open.badge)}</span> : null}
                </div>
                <p className="mt-1 text-lg font-semibold text-[var(--chan-blue)]">{money.format(open.price)}</p>
              </div>
              <p className="text-sm leading-relaxed text-[var(--chan-body)]">{pick(open.description)}</p>
              {open.sizes ? (
                <div role="group" aria-label={tx("Rozmiar", "Size")}>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--chan-muted)]">{tx("Rozmiar", "Size")}</p>
                  <div className="flex flex-wrap gap-2">
                    {open.sizes.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSize(s)}
                        aria-pressed={size === s}
                        className={`h-10 min-w-10 rounded-full border px-3 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--chan-blue)] ${
                          size === s ? "border-[var(--chan-blue)] bg-[var(--chan-blue)] text-white" : "border-[var(--chan-line)] bg-[var(--chan-card)] hover:bg-[var(--chan-surface)]"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <div role="group" aria-label={tx("Ilość", "Quantity")} className="flex items-center gap-3">
                <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label={tx("Zmniejsz ilość", "Decrease quantity")} className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--chan-line)] hover:bg-[var(--chan-surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--chan-blue)]">
                  <Minus className="h-4 w-4" aria-hidden="true" />
                </button>
                <span className="w-6 text-center text-base font-semibold" aria-live="polite">{qty}</span>
                <button type="button" onClick={() => setQty((q) => Math.min(99, q + 1))} aria-label={tx("Zwiększ ilość", "Increase quantity")} className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--chan-line)] hover:bg-[var(--chan-surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--chan-blue)]">
                  <Plus className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCart((lines) => addToCart(lines, { productId: open.id, size, qty }));
                  setJustAdded(true);
                }}
                className="mt-auto rounded-full bg-[var(--chan-blue)] px-6 py-3 font-brand text-sm font-bold text-white transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--chan-blue)]"
              >
                {tx("Dodaj do koszyka", "Add to cart")}
              </button>
              <p className="min-h-5 text-center text-xs font-semibold text-[var(--chan-muted-2)]" aria-live="polite">
                {justAdded ? tx("Dodano do koszyka", "Added to cart") : ""}
              </p>
            </div>
          </div>
        </SectionDialog>
      ) : null}

      {cartOpen ? (
        <SectionDialog label={tx("Koszyk", "Cart")} onClose={() => setCartOpen(false)} side>
          <div className="flex min-h-0 flex-1 flex-col p-5 pt-6">
            <h2 className="font-brand text-xl font-bold">{tx("Koszyk", "Cart")}</h2>
            <p className="mt-2 rounded-2xl bg-[var(--chan-amber-soft)] px-3 py-2 text-xs text-[var(--chan-amber-ink)]">
              {tx("Prototyp: nic tu nie da się jeszcze kupić.", "Prototype: nothing here can be bought yet.")}
            </p>
            <ul className="mt-4 flex-1 divide-y divide-[var(--chan-line)] overflow-y-auto">
              {cart.length === 0 ? <li className="py-8 text-center text-sm text-[var(--chan-muted)]">{tx("Twój koszyk jest pusty.", "Your cart is empty.")}</li> : null}
              {cart.map((line) => {
                const product = DEMO_PRODUCTS.find((p) => p.id === line.productId);
                if (!product) return null;
                return (
                  <li key={`${line.productId}-${line.size ?? ""}`} className="flex items-center gap-3 py-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={product.image} alt="" className="h-14 w-14 shrink-0 rounded-2xl object-cover" />
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="truncate font-semibold">{pick(product.name)}{line.size ? ` · ${line.size}` : ""}</p>
                      <p className="text-[var(--chan-muted-2)]">{line.qty} × {money.format(product.price)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCart((lines) => lines.filter((l) => l !== line))}
                      aria-label={tx("Usuń", "Remove")}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--chan-muted)] hover:bg-[var(--chan-surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--chan-blue)]"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="mt-3 flex items-center justify-between border-t border-[var(--chan-line)] pt-3 text-sm font-semibold">
              <span>{tx("Razem", "Total")}</span>
              <span>{money.format(cartTotal)}</span>
            </div>
            <button type="button" disabled className="mt-3 rounded-full bg-[var(--chan-surface)] px-6 py-3 font-brand text-sm font-bold text-[var(--chan-muted)] disabled:cursor-not-allowed">
              {tx("Przejdź do kasy (wkrótce)", "Proceed to checkout (soon)")}
            </button>
          </div>
        </SectionDialog>
      ) : null}
    </div>
  );
}
