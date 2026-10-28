"use client";
// Legal sheet (docs/architecture/patron-zone.md, "Dokumenty prawne w kasie"): ONE component that shows a legal document
// (Terms, Privacy Policy, Patron Zone Terms) as a second dialog on top of the checkout, so the buyer never leaves it:
// no new tab, no reload, nothing of the checkout is unmounted (chosen option, currency, method and the ticked boxes stay).
//
// Built on the same Base UI dialog as the checkout, mounted INSIDE it (React-wise), which gives the nested behaviour for
// free: Escape and a press on the dimmed area close only the top dialog, Tab stays inside it, everything under it is
// inert, the page scroll stays locked, and focus goes back to where it was. What we add: aria-modal, a fixed header with
// a big Close button, focus returning to the exact link that was used (Safari does not focus links on click), a swipe-down
// on the header (touch only) and the lazily loaded document body.
//
// A link opens the sheet through <LegalLink> (legal-sheet-context.tsx); the link is a real link to the document page, so
// it also works without JavaScript, and the sheet offers the same page as a small "open in a new tab" action.
import React, { Suspense, lazy, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { ExternalLink, X } from "lucide-react";
import { getLocalizedHref, type Locale } from "@/lib/i18n/routing";
import type { Tx } from "@/lib/i18n/ui";
import { passTermsTitle } from "../premium-pass/PassTermsContent";
import { LegalSheetContext, type LegalSheetApi, type LegalSheetDoc } from "./legal-sheet-context";
import styles from "./legal-sheet.module.css";

export { LegalLink, useLegalSheet, type LegalSheetDoc } from "./legal-sheet-context";

// The long legal texts load only when a sheet is opened.
const LegalDocBody = lazy(() => import("./LegalDocBody"));

/** Dragging the header down by more than this (px) closes the sheet. */
const SWIPE_CLOSE_PX = 90;
const SWIPE_EXIT_MS = 180;

export function legalSheetTitle(tx: Tx, doc: LegalSheetDoc): string {
  if (doc === "privacy") return tx("Polityka Prywatności", "Privacy Policy");
  if (doc === "passTerms") return passTermsTitle(tx);
  return tx("Regulamin serwisu", "Terms of Service");
}

/**
 * Provides the sheet to everything below it: <LegalLink> anywhere in `children` opens it. Put it INSIDE the dialog it sits
 * on (the checkout's popup), not around it, so the two dialogs nest.
 */
export function LegalSheetProvider({ tx, language, demo, children }: { tx: Tx; language: Locale; demo: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [doc, setDoc] = useState<LegalSheetDoc>("terms");
  const openRef = useRef(false);
  const openerRef = useRef<HTMLElement | null>(null);

  const api = useMemo<LegalSheetApi>(
    () => ({
      open(next, opener) {
        // Switching documents inside an open sheet keeps the original opener.
        if (!openRef.current) openerRef.current = opener ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
        openRef.current = true;
        setDoc(next);
        setOpen(true);
      },
    }),
    [],
  );
  const close = useCallback(() => {
    openRef.current = false;
    setOpen(false);
  }, []);

  return (
    <LegalSheetContext.Provider value={api}>
      {children}
      <LegalSheet open={open} doc={doc} tx={tx} language={language} demo={demo} openerRef={openerRef} onClose={close} />
    </LegalSheetContext.Provider>
  );
}

interface LegalSheetProps {
  open: boolean;
  doc: LegalSheetDoc;
  tx: Tx;
  language: Locale;
  demo: boolean;
  openerRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function LegalSheet({ open, doc, tx, language, demo, openerRef, onClose }: LegalSheetProps) {
  const titleId = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const shownDoc = useRef(doc);
  // Swipe-down state: `dragY` is the current offset (null = at rest), `leaving` = released past the threshold and sliding out.
  const [dragY, setDragY] = useState<number | null>(null);
  const [leaving, setLeaving] = useState(false);
  const drag = useRef<{ id: number; startY: number } | null>(null);
  const exitTimer = useRef<number | null>(null);

  useEffect(() => {
    if (open) {
      setDragY(null);
      setLeaving(false);
    }
  }, [open]);

  // Switching document inside the open sheet (Patron Zone Terms -> Terms): start at the top and announce the new title.
  useEffect(() => {
    if (shownDoc.current === doc) return;
    shownDoc.current = doc;
    if (!open) return;
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
    titleRef.current?.focus({ preventScroll: true });
  }, [doc, open]);

  useEffect(() => () => {
    if (exitTimer.current !== null) window.clearTimeout(exitTimer.current);
  }, []);

  const finalFocus = useCallback(() => {
    const opener = openerRef.current;
    return opener && opener.isConnected ? opener : true;
  }, [openerRef]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    // Touch and pen only (a mouse has the Close button and Escape); never from the links and buttons of the header.
    if (event.pointerType === "mouse" || !event.isPrimary || leaving) return;
    if ((event.target as HTMLElement).closest("a, button")) return;
    drag.current = { id: event.pointerId, startY: event.clientY };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    setDragY(Math.max(0, event.clientY - current.startY));
  };
  const endDrag = (event: React.PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    drag.current = null;
    const distance = Math.max(0, event.clientY - current.startY);
    if (cancelled || distance <= SWIPE_CLOSE_PX) {
      setDragY(null);
      return;
    }
    if (prefersReducedMotion()) {
      onClose();
      return;
    }
    setLeaving(true);
    setDragY(window.innerHeight);
    exitTimer.current = window.setTimeout(onClose, SWIPE_EXIT_MS);
  };

  const href = getLocalizedHref(language, doc);
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogPrimitive.Portal>
        {/* forceRender: a nested dialog draws no backdrop by default; the sheet needs its own dimming and tap-to-close area. */}
        <DialogPrimitive.Backdrop className={styles.backdrop} forceRender />
        <DialogPrimitive.Popup
          className={styles.sheet}
          aria-modal="true"
          aria-labelledby={titleId}
          initialFocus={titleRef}
          finalFocus={finalFocus}
          data-legal-sheet={doc}
          style={dragY === null ? undefined : { transform: `translateY(${dragY}px)`, transition: leaving ? undefined : "none" }}
        >
          <div
            className={styles.head}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={(event) => endDrag(event, false)}
            onPointerCancel={(event) => endDrag(event, true)}
          >
            <span className={styles.grabber} aria-hidden="true" />
            <div className={styles.headRow}>
              <div className={styles.headText}>
                <DialogPrimitive.Title render={<h2 ref={titleRef} tabIndex={-1} id={titleId} className={styles.title} />}>
                  {legalSheetTitle(tx, doc)}
                </DialogPrimitive.Title>
                <a className={styles.newTab} href={href} target="_blank" rel="noopener noreferrer">
                  <ExternalLink aria-hidden="true" focusable="false" />
                  {tx("Otwórz w nowej karcie", "Open in a new tab")}
                </a>
              </div>
              <DialogPrimitive.Close className={styles.close}>
                <X aria-hidden="true" focusable="false" />
                <span>{tx("Zamknij", "Close")}</span>
              </DialogPrimitive.Close>
            </div>
          </div>
          {/* Focusable on purpose: the arrow keys, Space and Page Up/Down scroll the document from the keyboard. */}
          <div ref={bodyRef} className={styles.body} role="region" aria-labelledby={titleId} tabIndex={0}>
            <Suspense fallback={<p className={styles.loading} role="status">{tx("Ładowanie…", "Loading…")}</p>}>
              <LegalDocBody doc={doc} tx={tx} language={language} demo={demo} />
            </Suspense>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
