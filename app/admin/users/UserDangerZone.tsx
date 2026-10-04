"use client";

import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/app/hooks/useToast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AdminActionError, readAdminActionError, signOutAndReturnHere } from "./admin-account-actions";

interface UserDangerZoneProps {
  userId: string;
  email: string;
  role: string;
  isDeleted: boolean;
  /** The signed-in admin is looking at their own account. */
  isSelf: boolean;
}

/**
 * "Strefa zagrożenia": delete the account (DELETE /api/admin/users/[userId]). The confirm button unlocks
 * only after the user's e-mail is typed back; the server checks it again.
 */
export function UserDangerZone({ userId, email, role, isDeleted, isSelf }: UserDangerZoneProps) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [typedEmail, setTypedEmail] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<AdminActionError | null>(null);
  const pendingRef = useRef(false);

  const blockedReason = isSelf
    ? "Nie możesz usunąć własnego konta z panelu admina."
    : isDeleted
      ? "To konto jest już usunięte."
      : role === "ADMIN"
        ? "Nie można usunąć administratora. Najpierw odbierz mu rolę ADMIN w sekcji „Rola i uprawnienia”."
        : null;
  const emailMatches = typedEmail.trim().toLowerCase() === email.trim().toLowerCase();

  function onOpenChange(next: boolean) {
    if (isPending) return;
    setOpen(next);
    setTypedEmail("");
    setError(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!emailMatches || pendingRef.current) return;
    pendingRef.current = true;
    setIsPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmEmail: typedEmail.trim() }),
      });
      if (!response.ok) {
        setError(await readAdminActionError(response));
        return;
      }
      toast("Użytkownik został usunięty.", "success");
      setOpen(false);
      router.push("/admin/users?deleted=1");
    } catch {
      setError({ code: "NETWORK", message: "Błąd połączenia z serwerem. Spróbuj ponownie." });
    } finally {
      pendingRef.current = false;
      setIsPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Usunięcie konta jest nieodwracalne.</p>
      <Button
        type="button"
        size="sm"
        variant="destructive"
        disabled={Boolean(blockedReason) || isPending}
        onClick={() => onOpenChange(true)}
        className="h-8 text-[10px] uppercase font-bold"
      >
        Usuń użytkownika
      </Button>
      {blockedReason && <p className="text-xs text-muted-foreground">{blockedReason}</p>}

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg" showCloseButton={!isPending}>
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-destructive">Usunąć użytkownika?</DialogTitle>
              <DialogDescription>
                Konto <strong className="break-all">{email}</strong> zostanie usunięte tak samo, jak przy usunięciu przez samego użytkownika.
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <p className="font-bold">Skutki</p>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                <li>Dane logowania zostaną usunięte: hasło, powiązanie z Google, logowanie dwuetapowe i wszystkie sesje. Nie da się już zalogować na to konto.</li>
                <li>Adres e-mail, pseudonim i zdjęcie profilu zostaną zanonimizowane; subskrypcja i zgody na e-maile znikną.</li>
                <li>Wpłaty i komentarze zostają, jako anonimowe („Usunięty Użytkownik”).</li>
                <li>Użytkownik dostanie e-mail z informacją o usunięciu konta.</li>
                <li>Operacji nie da się cofnąć.</li>
              </ul>
            </div>

            <div className="space-y-1">
              <label htmlFor="delete-user-confirm-email" className="block text-sm font-medium">
                Wpisz adres e-mail użytkownika, aby potwierdzić
              </label>
              <Input
                id="delete-user-confirm-email"
                type="email"
                autoComplete="off"
                value={typedEmail}
                onChange={(event) => setTypedEmail(event.target.value)}
                disabled={isPending}
              />
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
              <Button type="submit" variant="destructive" disabled={!emailMatches || isPending}>
                {isPending ? "Usuwam…" : "Usuń użytkownika na zawsze"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
