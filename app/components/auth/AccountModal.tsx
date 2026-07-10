"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useUser, useClerk } from "@clerk/nextjs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLanguage } from "../LanguageContext";
import {
  ProfileSection,
  EmailSection,
  ConnectionsSection,
  SecuritySection,
  NotificationsSection,
  DangerSection,
} from "./AccountSections";

interface AccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAdmin: boolean;
}

type Section = "profile" | "email" | "connections" | "security" | "notifications" | "danger";

export default function AccountModal({ open, onOpenChange, isAdmin }: AccountModalProps) {
  const { user } = useUser();
  const { signOut } = useClerk();
  const { language } = useLanguage();
  const isPl = language === "pl";
  const [section, setSection] = useState<Section>("profile");

  useEffect(() => {
    if (open) setSection("profile");
  }, [open]);

  if (!user) return null;

  const sections: { id: Section; label: string }[] = [
    { id: "profile", label: isPl ? "Profil" : "Profile" },
    { id: "email", label: "E-mail" },
    { id: "connections", label: isPl ? "Konta" : "Connections" },
    { id: "security", label: isPl ? "Hasło" : "Security" },
    { id: "notifications", label: isPl ? "Powiadomienia" : "Notifications" },
    { id: "danger", label: isPl ? "Usuń" : "Delete" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg overflow-hidden border-none bg-transparent p-0 shadow-none">
        <div className="rounded-2xl border border-[var(--chan-line)] bg-[var(--chan-card)] p-6 shadow-[0_20px_50px_rgba(23,23,23,0.14)] sm:p-7">
          <div>
            <DialogHeader>
              <DialogTitle className="font-brand text-2xl font-bold tracking-tight text-[var(--chan-ink)]">
                {isPl ? "Moje konto" : "My account"}
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
              {section === "profile" && <ProfileSection isPl={isPl} />}
              {section === "email" && <EmailSection isPl={isPl} />}
              {section === "connections" && <ConnectionsSection isPl={isPl} />}
              {section === "security" && <SecuritySection isPl={isPl} />}
              {section === "notifications" && <NotificationsSection isPl={isPl} />}
              {section === "danger" && <DangerSection isPl={isPl} onDeleted={() => onOpenChange(false)} />}
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-[var(--chan-line)] pt-4">
              {isAdmin ? (
                <Link href="/admin" className="font-sans text-[13px] font-bold text-[var(--chan-ink)] underline hover:text-[#2563EB]">
                  {isPl ? "Zarządzaj kanałem" : "Manage channel"}
                </Link>
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
                {isPl ? "Wyloguj się" : "Sign out"}
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
