"use client";

import { useRef, useState } from "react";
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
import { AdminActionError, readAdminActionError, signOutAndReturnHere } from "./admin-account-actions";

interface UserRoleActionsProps {
  userId: string;
  role: string;
  emailVerified: boolean;
  isDeleted: boolean;
  /** The signed-in admin is looking at their own account. */
  isSelf: boolean;
  onActionComplete: () => void;
}

/** "Rola i uprawnienia": grant or remove the ADMIN role (PATCH /api/admin/users/[userId]/role), always confirmed. */
export function UserRoleActions({ userId, role, emailVerified, isDeleted, isSelf, onActionComplete }: UserRoleActionsProps) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<AdminActionError | null>(null);
  const pendingRef = useRef(false);

  const isAdmin = role === "ADMIN";
  const nextRole = isAdmin ? "USER" : "ADMIN";
  const blockedReason = isSelf
    ? "Nie możesz zmienić własnej roli."
    : isDeleted
      ? "Konto jest usunięte."
      : !isAdmin && !emailVerified
        ? "Rolę ADMIN może dostać tylko konto z potwierdzonym adresem e-mail."
        : null;

  function onOpenChange(next: boolean) {
    if (isPending) return;
    setOpen(next);
    if (next) setError(null);
  }

  async function submit() {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setIsPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: nextRole }),
      });
      if (!response.ok) {
        setError(await readAdminActionError(response));
        return;
      }
      const message = nextRole === "ADMIN" ? "Nadano rolę ADMIN." : "Odebrano rolę ADMIN.";
      toast(message, "success");
      setOpen(false);
      onActionComplete();
    } catch {
      setError({ code: "NETWORK", message: "Błąd połączenia z serwerem. Spróbuj ponownie." });
    } finally {
      pendingRef.current = false;
      setIsPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Obecna rola:</span>
        <span className="font-semibold">{isAdmin ? "ADMIN (administrator)" : "USER (zwykłe konto)"}</span>
      </div>

      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={Boolean(blockedReason) || isPending}
        onClick={() => onOpenChange(true)}
        className="h-8 text-[10px] uppercase font-bold"
      >
        {isAdmin ? "Odbierz rolę ADMIN" : "Nadaj rolę ADMIN"}
      </Button>
      {blockedReason && <p className="text-xs text-muted-foreground">{blockedReason}</p>}

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg" showCloseButton={!isPending}>
          <DialogHeader>
            <DialogTitle>{isAdmin ? "Odebrać rolę ADMIN?" : "Nadać rolę ADMIN?"}</DialogTitle>
            <DialogDescription>Zmiana działa od następnego żądania tego użytkownika i trafia do historii zmian.</DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-bold">Skutki</p>
            {isAdmin ? (
              <ul className="mt-1 list-disc space-y-1 pl-5">
                <li>Użytkownik straci dostęp do panelu admina i wszystkich operacji administracyjnych.</li>
                <li>Konto, jego wpłaty i komentarze zostają bez zmian.</li>
                <li>Nie można odebrać roli ostatniemu administratorowi.</li>
              </ul>
            ) : (
              <ul className="mt-1 list-disc space-y-1 pl-5">
                <li>Użytkownik dostanie pełny dostęp do panelu admina: filmy, użytkownicy, wpłaty i zwroty, rozsyłki e-mail, moderacja.</li>
                <li>Będzie mógł też zmieniać role i usuwać konta innych użytkowników.</li>
                <li>Nadawaj tylko zaufanym osobom; konto powinno mieć włączone logowanie dwuetapowe.</li>
              </ul>
            )}
          </div>

          {error && (
            <div role="alert" className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs font-medium text-destructive">
              <p>{error.message}</p>
              {error.code === "REAUTH_REQUIRED" && (
                <Button type="button" size="sm" variant="outline" onClick={() => void signOutAndReturnHere()}>
                  Wyloguj i zaloguj ponownie
                </Button>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" disabled={isPending} onClick={() => onOpenChange(false)}>
              Anuluj
            </Button>
            <Button type="button" disabled={isPending} onClick={() => void submit()}>
              {isPending ? "Zapisuję…" : isAdmin ? "Odbierz rolę ADMIN" : "Nadaj rolę ADMIN"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
