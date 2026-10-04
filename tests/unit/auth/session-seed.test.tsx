/** @vitest-environment jsdom */

import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => {
  let state: { data: unknown; isPending: boolean } = { data: null, isPending: true };
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(next: { data: unknown; isPending: boolean }) {
      state = next;
      listeners.forEach((l) => l());
    },
    reset() {
      state = { data: null, isPending: true };
    },
    listeners,
    hydrateSession: vi.fn(),
  };
});

vi.mock("@/lib/auth/client", async () => {
  const { useSyncExternalStore } = await import("react");
  return {
    authClient: {
      useSession: () =>
        useSyncExternalStore(
          (cb) => {
            store.listeners.add(cb);
            return () => store.listeners.delete(cb);
          },
          store.get,
          () => ({ data: null, isPending: true }),
        ),
      hydrateSession: store.hydrateSession,
    },
  };
});
vi.mock("@/lib/auth/sign-out", () => ({ signOutCompletely: vi.fn() }));

import { AuthSessionSeedProvider, useAuth, useUser } from "@/lib/auth/react";
import { toAuthSessionSnapshot } from "@/lib/auth/session-snapshot";

function Who() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const { user } = useUser();
  if (!isLoaded) return <span data-testid="who">loading</span>;
  return <span data-testid="who">{isSignedIn ? `${userId}:${user?.fullName}` : "guest"}</span>;
}

const signedIn = toAuthSessionSnapshot({
  userId: "u1",
  sessionId: "s1",
  sessionExpiresAt: new Date("2030-01-01T00:00:00Z"),
  user: { id: "u1", email: "a@example.com", name: "Ala", image: null, emailVerified: true },
});

beforeEach(() => {
  store.reset();
  store.hydrateSession.mockClear();
});
afterEach(() => cleanup());

describe("session snapshot from the server", () => {
  it("renders the signed-in viewer in the server HTML, with no loading state", () => {
    const html = renderToString(
      <AuthSessionSeedProvider snapshot={signedIn}>
        <Who />
      </AuthSessionSeedProvider>,
    );
    expect(html).toContain("u1:Ala");
    expect(html).not.toContain("loading");
  });

  it("renders a guest as a guest at once (the server knows nobody is signed in)", () => {
    const html = renderToString(
      <AuthSessionSeedProvider snapshot={null}>
        <Who />
      </AuthSessionSeedProvider>,
    );
    expect(html).toContain("guest");
  });

  it("without a snapshot keeps the old behaviour (loading until the client knows)", () => {
    expect(renderToString(<Who />)).toContain("loading");
  });

  it("never carries the session token to the browser", () => {
    expect(JSON.stringify(signedIn)).not.toMatch(/token/i);
    expect(toAuthSessionSnapshot({ userId: null, sessionId: null, user: null })).toBeNull();
  });

  it("hands the signed-in session to the client store, then follows the client (sign-out is not masked)", () => {
    render(
      <AuthSessionSeedProvider snapshot={signedIn}>
        <Who />
      </AuthSessionSeedProvider>,
    );
    expect(screen.getByTestId("who").textContent).toBe("u1:Ala");
    expect(store.hydrateSession).toHaveBeenCalledWith(signedIn);

    act(() => store.set({ data: null, isPending: false }));
    expect(screen.getByTestId("who").textContent).toBe("guest");

    // A later refetch puts the client store back in "pending": the retired snapshot must not return.
    act(() => store.set({ data: null, isPending: true }));
    expect(screen.getByTestId("who").textContent).toBe("loading");
  });
});
