"use client";

import React, { useEffect, useState } from "react";
import { ADMIN_PANEL_ORIGIN } from "@/lib/admin-legacy-redirects";
import { useAuth, useUser } from "@/lib/auth/react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLanguage } from "../LanguageContext";
import { ProfileSection } from "./ProfileSection";
import { EmailSection, ConnectionsSection, DangerSection } from "./AccountSections";
import { SecuritySection } from "./SecuritySection";
import { PasskeysSection } from "./PasskeysSection";
import { NotificationsSection } from "./NotificationsSection";
import { PassAccountSection } from "../premium-pass/PassAccountSection"; // experiment: premium-pass (docs/experiments/premium-pass.md)
import { usePremiumPassStatus } from "../premium-pass/usePremiumPass"; // experiment: premium-pass

interface AccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAdmin: boolean;
}

type Section = "profile" | "notifications" | "email" | "connections" | "security" | "passkeys" | "danger" | "pass";

export default function AccountModal({ open, onOpenChange, isAdmin }: AccountModalProps) {
  const { user } = useUser();
  const { signOut } = useAuth();
  const { language } = useLanguage();
  const { tx } = useLanguage();
  const [section, setSection] = useState<Section>("profile");
  const pass = usePremiumPassStatus(open); // experiment: premium-pass: null when the experiment is invisible (404)

  useEffect(() => {
    if (open) setSection("profile");
  }, [open]);

  if (!user) return null;

  const sections: { id: Section; label: string }[] = [
    { id: "profile", label: tx("Profil", "Profile") },
    { id: "notifications", label: tx("Powiadomienia", "Notifications") },
    { id: "email", label: "E-mail" },
    { id: "connections", label: tx("Konta", "Connections") },
    { id: "security", label: tx("Hasło", "Security") },
    { id: "passkeys", label: tx("Klucze dostępu", "Passkeys") },
    { id: "danger", label: tx("Usuń", "Delete") },
    ...(pass.status ? [{ id: "pass" as const, label: tx("Wejściówka", "Pass") }] : []),
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg overflow-hidden border-none bg-transparent p-0 shadow-none">
        <div className="rounded-2xl border border-[var(--chan-line)] bg-[var(--chan-card)] p-6 shadow-[0_20px_50px_rgba(23,23,23,0.14)] sm:p-7">
          <div>
            <DialogHeader>
              <DialogTitle className="font-brand text-2xl font-bold tracking-tight text-[var(--chan-ink)]">
                {tx("Moje konto", "My account")}
              </DialogTitle>
            </DialogHeader>

            <div className="mt-4 flex flex-wrap gap-1.5 border-b border-[var(--chan-line)] pb-3">
              {sections.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSection(s.id)}
                  className={
                    "rounded-full px-3 py-1 font-sans text-[12px] font-bold uppercase tracking-wide transition-colors " +
                    (section === s.id ? "bg-[var(--chan-ink)] text-white" : "text-[var(--chan-muted)] hover:bg-[var(--chan-surface)]")
                  }
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className="mt-4 max-h-[60vh] overflow-y-auto pr-1">
              {section === "profile" && <ProfileSection tx={tx} />}
              {section === "notifications" && <NotificationsSection tx={tx} />}
              {section === "email" && <EmailSection tx={tx} />}
              {section === "connections" && <ConnectionsSection tx={tx} />}
              {section === "security" && <SecuritySection tx={tx} />}
              {section === "passkeys" && <PasskeysSection tx={tx} />}
              {section === "danger" && <DangerSection tx={tx} onDeleted={() => onOpenChange(false)} />}
              {section === "pass" && pass.status && <PassAccountSection tx={tx} status={pass.status} />}
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-[var(--chan-line)] pt-4">
              {isAdmin ? (
                <a href={ADMIN_PANEL_ORIGIN} target="_blank" rel="noopener noreferrer" className="font-sans text-[13px] font-bold text-[var(--chan-ink)] underline hover:text-[var(--chan-blue)]">
                  {tx("Panel admina", "Admin panel")}
                </a>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  void signOut();
                }}
                className="font-sans text-[13px] font-bold text-red-600 hover:underline"
              >
                {tx("Wyloguj się", "Sign out")}
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
