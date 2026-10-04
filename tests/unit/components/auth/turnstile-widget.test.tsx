// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, act, fireEvent, waitFor } from "@testing-library/react";

let siteKey: string | null = "site-key";
vi.mock("@/lib/auth/public-config", () => ({
  useAuthPublicConfig: () => ({ turnstileSiteKey: siteKey }),
}));

import { TurnstileWidget, type CaptchaState } from "@/app/components/auth/TurnstileWidget";

type RenderOptions = Record<string, unknown> & Record<string, (...args: unknown[]) => void>;
let options: RenderOptions;
const api = { render: vi.fn(), reset: vi.fn(), remove: vi.fn() };

function mount(props: { onToken?: (t: string | null) => void; onStateChange?: (s: CaptchaState) => void; isPl?: boolean } = {}) {
  return render(<TurnstileWidget onToken={props.onToken ?? vi.fn()} onStateChange={props.onStateChange} isPl={props.isPl ?? true} />);
}

describe("TurnstileWidget (interaction-only)", () => {
  beforeEach(() => {
    siteKey = "site-key";
    api.render.mockReset().mockImplementation((_el: HTMLElement, opts: RenderOptions) => {
      options = opts;
      return "widget-1";
    });
    api.reset.mockReset();
    api.remove.mockReset();
    (window as unknown as { turnstile: typeof api }).turnstile = api;
  });
  afterEach(() => {
    cleanup();
    delete (window as { turnstile?: unknown }).turnstile;
  });

  it("renders nothing without a site key", () => {
    siteKey = null;
    mount();
    expect(screen.queryByTestId("turnstile-widget")).toBeNull();
    expect(api.render).not.toHaveBeenCalled();
  });

  it("renders in interaction-only mode with flexible size and automatic refresh", async () => {
    mount({ isPl: false });
    await waitFor(() => expect(api.render).toHaveBeenCalledTimes(1));
    expect(options).toMatchObject({
      sitekey: "site-key",
      appearance: "interaction-only",
      size: "flexible",
      theme: "light",
      language: "en",
      retry: "auto",
      "refresh-expired": "auto",
      "refresh-timeout": "auto",
    });
  });

  it("stays out of the layout while hidden and in flow once Cloudflare needs interaction", async () => {
    const states: CaptchaState[] = [];
    mount({ onStateChange: (s) => states.push(s) });
    await waitFor(() => expect(api.render).toHaveBeenCalled());
    const box = screen.getByTestId("turnstile-widget");
    // Hidden: a collapsed grid row with no margin (no gap in the form), still full width for Cloudflare.
    expect(box.dataset.visible).toBe("false");
    expect(box.className).toContain("grid-rows-[0fr]");
    expect(box.className).toContain("!my-0");
    expect(screen.queryByRole("status")).toBeNull();

    act(() => options["before-interactive-callback"]());
    expect(box.dataset.visible).toBe("true");
    expect(box.className).toContain("grid-rows-[1fr]");
    expect(box.className).not.toContain("!my-0");
    expect(screen.getByRole("status").textContent).toContain("nie jesteś botem");

    act(() => options["after-interactive-callback"]());
    expect(box.dataset.visible).toBe("false");
    expect(states).toEqual(["checking", "interactive", "checking"]);
  });

  it("delivers the token, clears it on expiry and timeout", async () => {
    const onToken = vi.fn();
    const onState = vi.fn();
    mount({ onToken, onStateChange: onState });
    await waitFor(() => expect(api.render).toHaveBeenCalled());

    act(() => (options.callback as (t: string) => void)("tok"));
    expect(onToken).toHaveBeenLastCalledWith("tok");
    expect(onState).toHaveBeenLastCalledWith("verified");

    act(() => options["expired-callback"]());
    expect(onToken).toHaveBeenLastCalledWith(null);
    expect(onState).toHaveBeenLastCalledWith("checking");

    act(() => options["timeout-callback"]());
    expect(onToken).toHaveBeenLastCalledWith(null);
    expect(onState).toHaveBeenLastCalledWith("checking");
  });

  it("shows a friendly retry message on error and renders a fresh widget on retry", async () => {
    const onToken = vi.fn();
    mount({ onToken, isPl: false });
    await waitFor(() => expect(api.render).toHaveBeenCalledTimes(1));

    act(() => options["error-callback"]());
    expect(onToken).toHaveBeenLastCalledWith(null);
    expect(screen.getByRole("alert").textContent).toContain("security check");

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(api.render).toHaveBeenCalledTimes(2));
    expect(api.remove).toHaveBeenCalledWith("widget-1");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("reports failure (not a stuck spinner) when the script cannot load", async () => {
    delete (window as { turnstile?: unknown }).turnstile;
    const onState = vi.fn();
    mount({ onStateChange: onState });
    const script = await waitFor(() => {
      const el = document.head.querySelector('script[src*="challenges.cloudflare.com"]') as HTMLScriptElement | null;
      expect(el).not.toBeNull();
      return el!;
    });
    act(() => script.onerror?.(new Event("error")));
    await waitFor(() => expect(onState).toHaveBeenLastCalledWith("failed"));
    expect(screen.getByRole("alert").textContent).toContain("Spróbuj ponownie");
  });
});
