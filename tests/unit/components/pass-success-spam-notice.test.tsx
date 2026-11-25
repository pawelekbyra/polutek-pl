/** @vitest-environment jsdom */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import React from "react";
import { PassSuccess } from "@/app/components/premium-pass/PassSuccess";
import { createTx } from "@/lib/i18n/ui";
import { loadCatalog } from "@/lib/i18n/catalog";

afterEach(() => cleanup());

const base = { state: "active", lifetime: true, productId: "ACCESS_LIFETIME", ref: "pay_1", expiresAt: null, grantedAt: "2026-10-21T10:00:00.000Z", method: "blik", priceMinor: 2999, currency: "PLN", totalMinor: 2999, waiverAt: "2026-10-21T10:00:00.000Z" };

describe("PassSuccess spam-folder notice", () => {
  it("tells a real buyer to check Spam if the confirmation e-mail is missing", () => {
    render(<PassSuccess tx={createTx("en")} language="en" pass={{ ...base, provider: "STRIPE" } as never} onWatch={vi.fn()} />);
    expect(screen.getByText("Can't find the email? Check your Spam folder too.")).toBeTruthy();
  });

  it("is localised and absent from the demo flow (no real e-mail is sent)", async () => {
    render(<PassSuccess tx={createTx("pl")} language="pl" pass={{ ...base, provider: "STRIPE" } as never} onWatch={vi.fn()} />);
    expect(screen.getByText("Nie widzisz wiadomości? Sprawdź też folder Spam.")).toBeTruthy();
    cleanup();
    render(<PassSuccess tx={createTx("de", await loadCatalog("de"))} language="de" pass={{ ...base, provider: "STRIPE" } as never} onWatch={vi.fn()} />);
    expect(screen.getByText("Keine E-Mail gefunden? Prüfen Sie auch Ihren Spam-Ordner.")).toBeTruthy();
    cleanup();
    render(<PassSuccess tx={createTx("en")} language="en" pass={{ ...base, provider: "DEMO" } as never} onWatch={vi.fn()} />);
    expect(screen.queryByText(/Spam folder/)).toBeNull();
  });
});
