"use client";
/**
 * Six-digit code field (DESIGN-SYSTEM.md 3, "Ponowne uwierzytelnienie"): one box per digit, typing moves
 * forward, Backspace moves back, pasting or autofilling the whole code fills all boxes.
 */
import { useRef } from "react";

export function OtpInput({ value, onChange, onComplete, invalid, labelledBy, disabled }: { value: string; onChange: (v: string) => void; onComplete: (v: string) => void; invalid?: boolean; labelledBy: string; disabled?: boolean }) {
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? "");

  function set(next: string) {
    const clean = next.replace(/\D/g, "").slice(0, 6);
    onChange(clean);
    if (clean.length === 6) onComplete(clean);
  }

  return (
    <div className="otp" role="group" aria-labelledby={labelledBy}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            boxes.current[i] = el;
          }}
          className="input"
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          aria-label={`Cyfra ${i + 1} z 6`}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          value={d}
          maxLength={i === 0 ? 6 : 1}
          onChange={(e) => {
            const typed = e.target.value.replace(/\D/g, "");
            if (typed.length > 1) {
              // Several digits at once (fast typing or one-time-code autofill): spread from this box.
              const merged = (value.slice(0, i) + typed).slice(0, 6);
              set(merged);
              boxes.current[Math.min(5, merged.length)]?.focus();
              return;
            }
            const arr = digits.slice();
            arr[i] = typed;
            const merged = arr.join("").slice(0, 6);
            set(merged);
            if (typed && i < 5) boxes.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !d && i > 0) boxes.current[i - 1]?.focus();
          }}
          onPaste={(e) => {
            const t = (e.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, 6);
            if (t.length === 6) {
              e.preventDefault();
              set(t);
              boxes.current[5]?.focus();
            }
          }}
        />
      ))}
    </div>
  );
}
