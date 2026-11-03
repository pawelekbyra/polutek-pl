// patron zone: trust signals of the checkout (lock row, payment logos per currency, honest Stripe badge, footer separator).
import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PassTrustRow, paymentLogosFor } from "@/app/components/premium-pass/PassTrustRow";
import { PassSellerCard } from "@/app/components/premium-pass/PassSellerCard";
import { createTx } from "@/lib/i18n/ui";

const tx = createTx("pl", null);

describe("paymentLogosFor", () => {
  it("shows BLIK only for PLN with the BLIK method", () => {
    expect(paymentLogosFor(["blik", "card", "p24"], "PLN")).toEqual(["blik", "visa", "mastercard"]);
    expect(paymentLogosFor(["blik", "card"], "EUR")).toEqual(["visa", "mastercard"]);
    expect(paymentLogosFor(["p24"], "PLN")).toEqual([]);
    expect(paymentLogosFor(["card"], "PLN")).toEqual(["visa", "mastercard"]);
  });
});

describe("PassTrustRow", () => {
  it("claims a secure payment only in live mode and shows no logos in demo mode", () => {
    const live = renderToStaticMarkup(<PassTrustRow tx={tx} mode="live" methods={["card"]} currency="EUR" />);
    expect(live).toContain("Bezpieczna płatność SSL");
    expect(live).toContain('alt="Visa"');
    expect(live).not.toContain("BLIK");
    const test = renderToStaticMarkup(<PassTrustRow tx={tx} mode="test" methods={["card"]} currency="EUR" />);
    expect(test).not.toContain("płatność SSL");
    const demo = renderToStaticMarkup(<PassTrustRow tx={tx} mode="demo" methods={["card", "blik"]} currency="PLN" />);
    expect(demo).not.toContain("<img");
  });
});

describe("seller badge", () => {
  it("never says verified and names Stripe only when a gateway runs", () => {
    const live = renderToStaticMarkup(<PassSellerCard tx={tx} mode="live" />);
    expect(live).toContain("Płatność przetwarza Stripe");
    expect(live.toLowerCase()).not.toContain("zweryfikowan");
    expect(renderToStaticMarkup(<PassSellerCard tx={tx} mode="demo" />)).not.toContain("Stripe");
  });
});
