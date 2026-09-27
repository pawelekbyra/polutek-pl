"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./MatrixGatePrompt.module.css";

const TEXT = "Follow the white rabbit";
const CHAR_DELAY_MS = 65;

export function MatrixGatePrompt({ onEnter }: { onEnter: () => void }) {
  const [charCount, setCharCount] = useState(0);
  const [cursorOn, setCursorOn] = useState(true);
  const doneTyping = charCount >= TEXT.length;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCharCount((c) => {
        if (c >= TEXT.length) {
          clearInterval(timerRef.current!);
          return c;
        }
        return c + 1;
      });
    }, CHAR_DELAY_MS);
    return () => clearInterval(timerRef.current!);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setCursorOn((v) => !v), 530);
    return () => clearInterval(id);
  }, []);

  return (
    <div className={styles.overlay}>
      <p className={styles.text}>
        {TEXT.slice(0, charCount)}
        {!doneTyping && (
          <span className={styles.cursor} style={{ opacity: cursorOn ? 1 : 0 }} />
        )}
      </p>
      {doneTyping && (
        <button className={styles.btn} onClick={onEnter} aria-label="Enter">
          🐇
        </button>
      )}
    </div>
  );
}
