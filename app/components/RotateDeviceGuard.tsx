"use client";

import { RotateCw } from "lucide-react";
import { useLanguage } from "./LanguageContext";
import styles from "./RotateDeviceGuard.module.css";

/**
 * Phones rotated to landscape have too little vertical space for this
 * portrait-tuned layout to reflow into cleanly. Rather than chasing every
 * element that could misbehave, this blocks the view entirely and asks for
 * portrait back — a plain CSS media query (no JS orientation detection), so
 * it can't lag or miss the rotation event.
 */
export function RotateDeviceGuard() {
  const { language, tx } = useLanguage();
  return (
    <div className={styles.guard} role="alert" aria-live="polite">
      <RotateCw className={styles.icon} strokeWidth={1.8} aria-hidden="true" />
      <p className={styles.text}>
        {tx("Obróć telefon do pionu, aby kontynuować", "Rotate your phone to portrait to continue")}
      </p>
    </div>
  );
}
