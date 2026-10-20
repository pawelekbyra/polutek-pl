// experiment: premium-pass (docs/experiments/premium-pass.md): icons the shared set does not have.
import React from "react";

type P = { className?: string };

export function TicketIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false" fill="none">
      <path stroke="currentColor" strokeWidth="2" strokeLinejoin="round" d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4z" />
      <path stroke="currentColor" strokeWidth="2" strokeDasharray="2 2.5" d="M14 7v10" />
    </svg>
  );
}

export function LockIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false" fill="none">
      <path stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" d="M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3" />
    </svg>
  );
}

export function ShieldIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false" fill="none">
      <path stroke="currentColor" strokeWidth="2" strokeLinejoin="round" d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" />
      <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M9 12l2 2 4-4" />
    </svg>
  );
}

export function CheckIcon({ className, animated }: P & { animated?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false" fill="none">
      <path stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" d="M5 12.5l4.5 4.5L19 7.5" pathLength={animated ? 30 : undefined} />
    </svg>
  );
}

export function CrossIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false" fill="none">
      <path stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" d="M7 7l10 10M17 7L7 17" />
    </svg>
  );
}

export function PlayIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M8 5.5v13l11-6.5z" />
    </svg>
  );
}
