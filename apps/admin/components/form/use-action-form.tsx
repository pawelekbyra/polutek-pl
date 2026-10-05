"use client";
/**
 * One way to run a Server Action from a form: submitted by hand (so a refused save keeps what was typed),
 * pending state, the first field error focused, a toast on success, and the step-up redirect.
 */
import { useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect, useRef, type FormEvent } from "react";
import type { ActionResult } from "@admin/lib/actions/panel";
import { Icon } from "@admin/components/icons";
import { useToast } from "@admin/components/shell/toasts";

export type FormAction<T = undefined> = (prev: ActionResult<T> | null, fd: FormData) => Promise<ActionResult<T>>;

export function useActionForm<T = undefined>(action: FormAction<T>, opts: { onOk?: (state: Extract<ActionResult<T>, { ok: true }>) => void; returnTo?: string } = {}) {
  const [state, dispatch, pending] = useActionState<ActionResult<T> | null, FormData>(action, null);
  const { toast } = useToast();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const handled = useRef<unknown>(null);

  useEffect(() => {
    if (!state || handled.current === state) return;
    handled.current = state;
    if (state.ok) {
      toast("ok", state.message ?? "Zapisano");
      opts.onOk?.(state);
    } else {
      if (state.code === "STEP_UP_REQUIRED" && opts.returnTo) router.push(`/potwierdz?next=${encodeURIComponent(opts.returnTo)}`);
      const first = state.fieldErrors ? Object.keys(state.fieldErrors)[0] : null;
      if (first) formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
    }
  }, [state, toast, router, opts]);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pending) return;
    const fd = new FormData(e.currentTarget);
    startTransition(() => dispatch(fd));
  };
  const errors: Record<string, string> = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  return { state, pending, errors, onSubmit, formRef };
}

/** The refusal line under a form (role=alert), shown when there is no more specific field error to focus. */
export function FormError({ state }: { state: ActionResult<unknown> | null }) {
  if (!state || state.ok) return null;
  return (
    <p className="form-error" role="alert">
      <Icon name="crit" />
      {state.message}
    </p>
  );
}
