import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

vi.mock("@clerk/nextjs", () => ({
  SignInButton: ({ children }: { children: React.ReactNode }) => children,
}));

import { AccessLockOverlay } from "../../../app/components/AccessLockOverlay";

const component = (path: string) =>
  readFileSync(join(process.cwd(), path), "utf8");

const renderOverlay = (state: "LOGIN_REQUIRED" | "PATRON_REQUIRED") =>
  renderToStaticMarkup(
    React.createElement(AccessLockOverlay, { state, variant: "thumbnail" }),
  );

describe("AccessLockOverlay", () => {
  it("renders the logged-in branded copy for LOGIN_REQUIRED", () => {
    const html = renderOverlay("LOGIN_REQUIRED");

    expect(html).toContain("Strefa");
    expect(html).toContain("Zalogowanych");
    expect(html).toContain("Zaloguj się, aby obczaić");
  });

  it("renders the patron branded copy for PATRON_REQUIRED", () => {
    const html = renderOverlay("PATRON_REQUIRED");

    expect(html).toContain("Strefa");
    expect(html).toContain("Patronów");
    expect(html).toContain("Wesprzyj, aby obczaić");
    expect(html).toContain("#donations");
  });
});

describe("ChannelVideoCard access badge source contract", () => {
  it("does not render a thumbnail badge when access is locked", () => {
    const source = component("app/components/ChannelVideoCard.tsx");

    expect(source).toContain("{badge && hasAccess && (");
    expect(source).not.toContain("{badge && (");
  });
});
