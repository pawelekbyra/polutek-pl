/** @vitest-environment jsdom */

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  language: "pl" as "pl" | "en",
  share: vi.fn(),
  copyToClipboard: vi.fn(),
  isMobile: false,
  canNativeShare: false,
  copied: false,
  installed: false,
  isIOS: false,
  canInstallDirectly: false,
  install: vi.fn(),
}));

vi.mock("@/app/components/LanguageContext", () => ({
  useLanguage: () => ({
    language: mocks.language,
    t: { share: mocks.language === "pl" ? "Szeruj" : "Share" },
  }),
}));

vi.mock("@/app/hooks/useShare", () => ({
  useShare: () => ({
    isMobile: mocks.isMobile,
    canNativeShare: mocks.canNativeShare,
    share: mocks.share,
    copied: mocks.copied,
    copyToClipboard: mocks.copyToClipboard,
  }),
}));

vi.mock("@/app/hooks/usePwaInstall", () => ({
  usePwaInstall: () => ({
    installed: mocks.installed,
    isIOS: mocks.isIOS,
    canInstallDirectly: mocks.canInstallDirectly,
    install: mocks.install,
  }),
}));

import InstallAppMenu from "@/app/components/InstallAppMenu";
import ShareButton from "@/app/components/ShareButton";

describe("ShareButton menu", () => {
  beforeEach(() => {
    mocks.language = "pl";
    mocks.isMobile = false;
    mocks.canNativeShare = false;
    mocks.copied = false;
    mocks.share.mockReset().mockResolvedValue("shared");
    mocks.copyToClipboard.mockReset().mockResolvedValue(true);
  });

  afterEach(() => {
    cleanup();
  });

  it("renders localized menu items and keeps copy feedback menu open", async () => {
    render(<ShareButton title="Film" url="https://example.com/film" />);

    fireEvent.click(screen.getByRole("button", { name: "Udostępnij" }));

    expect(await screen.findByRole("menu")).toBeTruthy();
    expect(screen.getAllByRole("menuitem")).toHaveLength(5);
    expect(
      screen.getByRole("menuitem", { name: "Udostępnij na X" }).getAttribute("href"),
    ).toContain("https://x.com/intent/tweet");

    fireEvent.click(screen.getByRole("menuitem", { name: "Kopiuj link" }));

    expect(mocks.copyToClipboard).toHaveBeenCalledWith("https://example.com/film");
    expect(screen.getByRole("menu")).toBeTruthy();
  });

  it("opens the fallback menu on mobile when native sharing is unavailable", async () => {
    mocks.isMobile = true;
    render(<ShareButton title="Film" url="https://example.com/film" />);

    fireEvent.click(screen.getByRole("button", { name: "Udostępnij" }));

    expect(await screen.findByRole("menu")).toBeTruthy();
    expect(mocks.share).not.toHaveBeenCalled();
  });

  it("uses native sharing on supported mobile devices without opening the menu", async () => {
    mocks.isMobile = true;
    mocks.canNativeShare = true;
    render(
      <ShareButton
        title="Film"
        text="Opis"
        url="https://example.com/film"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Udostępnij" }));

    await waitFor(() => {
      expect(mocks.share).toHaveBeenCalledWith({
        title: "Film",
        text: "Opis",
        url: "https://example.com/film",
      });
    });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("opens the fallback after a native share failure, but not after cancellation", async () => {
    mocks.isMobile = true;
    mocks.canNativeShare = true;
    mocks.share.mockResolvedValueOnce("failed");
    const view = render(<ShareButton title="Film" url="https://example.com/film" />);

    fireEvent.click(screen.getByRole("button", { name: "Udostępnij" }));
    expect(await screen.findByRole("menu")).toBeTruthy();

    view.unmount();
    mocks.share.mockResolvedValueOnce("cancelled");
    render(<ShareButton title="Film" url="https://example.com/film" />);
    fireEvent.click(screen.getByRole("button", { name: "Udostępnij" }));

    await waitFor(() => expect(mocks.share).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("supports arrow navigation, Escape and focus return", async () => {
    render(<ShareButton title="Film" url="https://example.com/film" />);
    const trigger = screen.getByRole("button", { name: "Udostępnij" });
    trigger.focus();

    fireEvent.keyDown(trigger, { key: "ArrowDown" });

    const copyItem = await screen.findByRole("menuitem", { name: "Kopiuj link" });
    await waitFor(() => expect(document.activeElement).toBe(copyItem));

    fireEvent.keyDown(copyItem, { key: "ArrowDown" });
    const xItem = screen.getByRole("menuitem", { name: "Udostępnij na X" });
    await waitFor(() => expect(document.activeElement).toBe(xItem));

    fireEvent.keyDown(xItem, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

  it("uses English trigger and menu copy", async () => {
    mocks.language = "en";
    render(<ShareButton title="Video" url="https://example.com/video" />);

    fireEvent.click(screen.getByRole("button", { name: "Share" }));

    expect(await screen.findByRole("menuitem", { name: "Copy link" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Send by email" })).toBeTruthy();
  });
});

describe("InstallAppMenu", () => {
  beforeEach(() => {
    mocks.language = "pl";
    mocks.installed = false;
    mocks.isIOS = false;
    mocks.canInstallDirectly = false;
    mocks.install.mockReset().mockResolvedValue("accepted");
  });

  afterEach(() => {
    cleanup();
  });

  it("exposes an unavailable browser message as a disabled menu item", async () => {
    render(<InstallAppMenu />);

    fireEvent.click(screen.getByRole("button", { name: "Zainstaluj aplikację" }));

    const item = await screen.findByRole("menuitem", {
      name: "Instalacja niedostępna w tej przeglądarce",
    });
    expect(item.getAttribute("aria-disabled")).toBe("true");
  });

  it("runs the captured browser install prompt and closes the menu", async () => {
    mocks.canInstallDirectly = true;
    render(<InstallAppMenu />);
    fireEvent.click(screen.getByRole("button", { name: "Zainstaluj aplikację" }));

    fireEvent.click(await screen.findByRole("menuitem", { name: "Zainstaluj aplikację" }));

    await waitFor(() => expect(mocks.install).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  });

  it("keeps the menu open to show iOS add-to-home-screen instructions", async () => {
    mocks.isIOS = true;
    render(<InstallAppMenu />);
    fireEvent.click(screen.getByRole("button", { name: "Zainstaluj aplikację" }));

    fireEvent.click(await screen.findByRole("menuitem", { name: "Zainstaluj aplikację" }));

    expect(await screen.findByText("Zainstaluj na iPhonie/iPadzie")).toBeTruthy();
    expect(screen.getByRole("menu")).toBeTruthy();
  });

  it("localizes the unavailable state in English", async () => {
    mocks.language = "en";
    render(<InstallAppMenu />);

    fireEvent.click(screen.getByRole("button", { name: "Install app" }));

    expect(
      await screen.findByRole("menuitem", {
        name: "Installation isn't available in this browser",
      }),
    ).toBeTruthy();
  });
});
