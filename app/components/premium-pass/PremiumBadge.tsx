"use client";
// experiment: premium-pass (docs/experiments/premium-pass.md, section 8.5): the PREMIUM plate on tiles and the
// "valid until" chip on a playing pass video. Text, not only colour; the lock is decoration next to the text.
import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useLanguage } from "../LanguageContext";
import { CheckIcon, LockIcon } from "./PassIcons";
import { passDate } from "./pass-copy";
import styles from "./premium-pass.module.css";

/** On a thumbnail: blurred veil + gold plate (locked), or the plate alone (viewer holds a pass). */
export function PremiumThumbBadge({ locked }: { locked: boolean }) {
  return (
    <>
      {locked && <span aria-hidden="true" className={styles.thumbVeil} />}
      <span className={cn(styles.pass, styles.badge, styles.thumbBadge)}>
        {locked && <LockIcon />}
        PREMIUM
      </span>
    </>
  );
}

/** Over the playing video for a few seconds: "Premium · valid until 20.11.2026". */
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
      {tx("Premium · ważna do {0}", "Premium · valid until {0}", passDate(language, until))}
    </span>
  );
}
