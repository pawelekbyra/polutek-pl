"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./MatrixGatePrompt.module.css";

const TEXT = "Follow the white rabbit";
const CHAR_DELAY_MS = 95;

export function MatrixGatePrompt({ onEnter }: { onEnter: () => void }) {
  const [charCount, setCharCount] = useState(0);
  const [cursorOn, setCursorOn] = useState(true);
  const doneTyping = charCount >= TEXT.length;
  const [showButton, setShowButton] = useState(false);
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

  useEffect(() => {
    if (!doneTyping) return;
    const timer = setTimeout(() => setShowButton(true), 700);
    return () => clearTimeout(timer);
  }, [doneTyping]);

  return (
    <div className={styles.overlay}>
      <p className={styles.text}>
        {TEXT.slice(0, charCount)}
        {!doneTyping && (
          <span className={styles.cursor} style={{ opacity: cursorOn ? 1 : 0 }} />
        )}
      </p>
      {/* Always in DOM so the text position never shifts when the button appears */}
      <button
        className={styles.btn}
        onClick={doneTyping ? onEnter : undefined}
        aria-label="Enter"
        style={{ opacity: showButton ? 1 : 0, pointerEvents: showButton ? "auto" : "none" }}
      >
        <img src="/rabbit.png" alt="" className={styles.rabbitImg} />
      </button>
    </div>
  );
}
