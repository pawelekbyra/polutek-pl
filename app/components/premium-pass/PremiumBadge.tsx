"use client";
// patron zone (docs/architecture/patron-zone.md): the PATRON plate on tiles and the
// "access until" chip on a playing patron-zone video. Text, not only colour; the lock is decoration next to the text.
import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useLanguage } from "../LanguageContext";
import { CheckIcon, LockIcon } from "./PassIcons";
import { passDate } from "./pass-copy";
import styles from "./premium-pass.module.css";

/** On a thumbnail: blurred veil + gold plate (locked), or the plate alone (viewer is a patron). */
export function PremiumThumbBadge({ locked }: { locked: boolean }) {
  return (
    <>
      {locked && <span aria-hidden="true" className={styles.thumbVeil} />}
      <span className={cn(styles.pass, styles.badge, styles.thumbBadge)}>
        {locked && <LockIcon />}
        PATRON
      </span>
    </>
  );
}

/** Over the playing video for a few seconds: "Patron · access until 20.11.2026". */
export function PremiumPlayerChip({ until }: { until: string }) {
  const { tx, language } = useLanguage();
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 6_000);
    return () => clearTimeout(timer);
  }, [until]);
  if (!visible) return null;
  return (
    <span className={cn(styles.pass, styles.chip, styles.playerChip)} role="status">
      <CheckIcon />
      {tx("Patron · dostęp do {0}", "Patron · access until {0}", passDate(language, until))}
    </span>
  );
}
