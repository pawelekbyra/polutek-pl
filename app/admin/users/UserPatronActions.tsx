"use client";

import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { logger } from "@/lib/logger";
import { useToast } from "@/app/hooks/useToast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface UserPatronActionsProps {
  userId: string;
  isPatron: boolean;
  onActionComplete?: () => void;
}

type PatronAction = "grant" | "revoke";

const actionCopy: Record<PatronAction, {
  buttonLabel: string;
  title: string;
  description: string;
  effect: string;
  confirmLabel: string;
  success: string;
  pending: string;
}> = {
  grant: {
    buttonLabel: "Nadaj Patrona",
    title: "Potwierdź nadanie dostępu Patrona",
    description: "Ta akcja utworzy lub aktywuje uprawnienie PatronGrant dla użytkownika.",
    effect: "Efekt dostępu: użytkownik otrzyma dostęp Patrona i będzie mógł korzystać z odtwarzania premium oraz uprawnień komentowania dla patronów.",
    confirmLabel: "Potwierdź nadanie",
    success: "Nadano status Patrona.",
    pending: "Nadaję dostęp…",
  },
  revoke: {
    buttonLabel: "Cofnij Patrona",
    title: "Potwierdź cofnięcie dostępu Patrona",
    description: "Ta akcja cofnie aktywne uprawnienie PatronGrant dla użytkownika.",
    effect: "Efekt dostępu: użytkownik straci dostęp Patrona, co może zablokować odtwarzanie premium oraz uprawnienia komentowania/reagowania dla patronów.",
    confirmLabel: "Cofnij dostęp Patrona",
    success: "Cofnięto status Patrona.",
    pending: "Cofam dostęp…",
  },
};

export function UserPatronActions({ userId, isPatron, onActionComplete }: UserPatronActionsProps) {
  const router = useRouter();
  const toast = useToast();
  const [dialogAction, setDialogAction] = useState<PatronAction | null>(null);
  const [reason, setReason] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const pendingRequestRef = useRef(false);

  const currentCopy = dialogAction ? actionCopy[dialogAction] : null;
  const trimmedReason = reason.trim();
  const canSubmit = Boolean(dialogAction) && trimmedReason.length > 0 && !isPending;

  function openDialog(action: PatronAction) {
    setDialogAction(action);
    setReason("");
    setFeedback(null);
  }

  function closeDialog(open: boolean) {
    if (open || isPending) return;
    setDialogAction(null);
    setReason("");
  }

  async function updatePatron(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dialogAction || !trimmedReason || pendingRequestRef.current) return;

    const action = dialogAction;
    const copy = actionCopy[action];
    pendingRequestRef.current = true;
    setIsPending(true);
    setFeedback(null);

    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/patron`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason: trimmedReason }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Nie udało się zmienić statusu Patrona.");
      }

      setFeedback({ type: "success", message: copy.success });
      setDialogAction(null);
      setReason("");
      toast(copy.success, "success");

      if (onActionComplete) {
        onActionComplete();
      } else {
        router.refresh();
      }
    } catch (error) {
      logger.error("[USER_PATRON_ACTION_ERROR]", error);
      const message = error instanceof Error ? error.message : "Nie udało się zmienić statusu Patrona.";
      setFeedback({ type: "error", message: `${message} Popraw powód albo spróbuj ponownie.` });
      toast(message, "error");
    } finally {
      pendingRequestRef.current = false;
      setIsPending(false);
    }
  }

  return (
    <div className="space-y-3">
      {feedback && (
        <div
          role="status"
          className={`rounded-lg border p-3 text-xs font-medium ${
            feedback.type === "success"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-destructive/30 bg-destructive/10 text-destructive"
          }`}
        >
          {feedback.message}
        </div>
      )}

      {isPatron ? (
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={isPending}
          onClick={() => openDialog("revoke")}
          className="h-8 text-[10px] uppercase font-bold"
        >
          {actionCopy.revoke.buttonLabel}
        </Button>
      ) : (
        <Button
          type="button"
          size="sm"
          disabled={isPending}
          onClick={() => openDialog("grant")}
          className="h-8 text-[10px] uppercase font-bold"
        >
          {actionCopy.grant.buttonLabel}
        </Button>
      )}

      <Dialog open={dialogAction !== null} onOpenChange={closeDialog}>
        {currentCopy && (
          <DialogContent className="sm:max-w-lg" showCloseButton={!isPending}>
            <form onSubmit={updatePatron} className="space-y-4">
              <DialogHeader>
                <DialogTitle className={dialogAction === "revoke" ? "text-destructive" : undefined}>
                  {currentCopy.title}
                </DialogTitle>
                <DialogDescription>{currentCopy.description}</DialogDescription>
              </DialogHeader>

              <div
                className={`rounded-lg border p-3 text-sm ${
                  dialogAction === "revoke"
                    ? "border-destructive/40 bg-destructive/10 text-destructive"
                    : "border-amber-200 bg-amber-50 text-amber-900"
                }`}
              >
                <p className="font-bold">Efekt dostępu przed potwierdzeniem</p>
                <p>{currentCopy.effect}</p>
                <p className="mt-2 text-xs">
                  Źródłem prawdy dostępu pozostaje aktywne uprawnienie PatronGrant. Płatność oraz newsletter/subskrypcja nie są źródłem prawdy dostępu.
                </p>
              </div>

              <label htmlFor="patron-action-reason" className="block text-sm font-medium">
                Powód wymagany do audytu
              </label>
              <textarea
                id="patron-action-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                disabled={isPending}
                required
                rows={4}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Wpisz konkretny powód ręcznej zmiany dostępu…"
              />
              {!trimmedReason && (
                <p className="text-xs text-muted-foreground">Wpisz niepusty powód, aby odblokować potwierdzenie.</p>
              )}

              {feedback?.type === "error" && (
                <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs font-medium text-destructive">
                  {feedback.message}
                </div>
              )}

              <DialogFooter>
                <Button type="button" variant="outline" disabled={isPending} onClick={() => closeDialog(false)}>
                  Anuluj bez zmian
                </Button>
                <Button
                  type="submit"
                  variant={dialogAction === "revoke" ? "destructive" : "default"}
                  disabled={!canSubmit}
                >
                  {isPending ? currentCopy.pending : currentCopy.confirmLabel}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
