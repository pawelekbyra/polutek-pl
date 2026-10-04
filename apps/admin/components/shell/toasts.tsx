"use client";
/**
 * Toasts (DESIGN-SYSTEM.md 3): bottom right (above the bottom bar on phones), role="status", 7 s
 * (12 s with an action), paused while hovered or focused.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "../icons";

type ToastKind = "ok" | "warn" | "crit";
type ToastItem = { id: number; kind: ToastKind; title: string; body?: string; action?: { label: string; run: () => void } };
type ToastApi = { toast: (kind: ToastKind, title: string, body?: string, action?: ToastItem["action"]) => void };

const ToastContext = createContext<ToastApi>({ toast: () => undefined });

export function useToast() {
  return useContext(ToastContext);
}

function Toast({ item, onClose }: { item: ToastItem; onClose: (id: number) => void }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const arm = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onClose(item.id), item.action ? 12_000 : 7_000);
  }, [item.action, item.id, onClose]);
  const pause = () => {
    if (timer.current) clearTimeout(timer.current);
  };
  useEffect(() => {
    arm();
    return pause;
  }, [arm]);
  const icon = item.kind === "ok" ? "ok" : item.kind === "warn" ? "warn" : "crit";
  return (
    <div className={`toast ${item.kind}`} onMouseEnter={pause} onMouseLeave={arm} onFocus={pause} onBlur={arm}>
      <Icon name={icon} />
      <div className="toast-body">
        <strong>{item.title}</strong>
        {item.body ? <span className="text-2">{item.body}</span> : null}
        {item.action ? (
          <div className="row">
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                item.action?.run();
                onClose(item.id);
              }}
            >
              {item.action.label}
            </button>
          </div>
        ) : null}
      </div>
      <button type="button" className="icon-btn" aria-label="Zamknij powiadomienie" onClick={() => onClose(item.id)}>
        <Icon name="close" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const close = useCallback((id: number) => setItems((all) => all.filter((t) => t.id !== id)), []);
  const toast = useCallback<ToastApi["toast"]>((kind, title, body, action) => {
    seq.current += 1;
    const id = seq.current;
    setItems((all) => [...all.slice(-3), { id, kind, title, body, action }]);
  }, []);
  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="toasts" role="status" aria-live="polite" aria-atomic="false">
        {items.map((t) => (
          <Toast key={t.id} item={t} onClose={close} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
