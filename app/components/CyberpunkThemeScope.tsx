"use client";

import { useEffect } from "react";

/**
 * CSS custom-property overrides scoped to `.public-visual-shell`/`.channel-page-shell`
 * (see app/globals.css) don't reach content rendered through a React portal —
 * Radix dropdowns/dialogs (UserMenu, CheckoutModal) mount as children of
 * document.body, outside that wrapper's DOM subtree, so they'd otherwise still
 * inherit :root's light-mode tokens. Adding the same scoping class to
 * document.body fixes that: CSS variables cascade through real DOM ancestry,
 * and body is an ancestor of any portal target.
 *
 * Only mount this from public-facing trees, never from anything that also
 * renders on /admin — admin has no Navbar-less entry point that both mounts
 * this and skips Navbar, so this file is deliberately its own component
 * rather than living inside Navbar.tsx (which admin pages also render).
 */
export default function CyberpunkThemeScope() {
  useEffect(() => {
    document.body.classList.add("chan-cyberpunk");
    return () => {
      document.body.classList.remove("chan-cyberpunk");
    };
  }, []);

  return null;
}
