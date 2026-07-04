"use client";

import React, { useEffect, useState } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Frame, INK } from "../najs/primitives";
import { useLanguage } from "../LanguageContext";
import {
  ProfileSection,
  EmailSection,
  ConnectionsSection,
  SecuritySection,
  DangerSection,
} from "./AccountSections";

interface AccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAdmin: boolean;
}

type Section = "profile" | "email" | "connections" | "security" | "danger";

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
    { id: "danger", label: isPl ? "Usuń" : "Delete" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg overflow-hidden border-none bg-transparent p-0 shadow-none">
        <div className="relative p-6 sm:p-7">
          <Frame radius={18} seed={17} stroke={INK} strokeWidth={1.4} fill="#f1ead9" />
          <div className="relative z-10">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black tracking-tight text-[#0f0f0f]">
                {isPl ? "Moje konto" : "My account"}
              </DialogTitle>
            </DialogHeader>

            <div className="mt-4 flex flex-wrap gap-1.5 border-b border-[#171717]/10 pb-3">
              {sections.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSection(s.id)}
                  className={
                    "rounded-full px-3 py-1 text-[12px] font-bold uppercase tracking-wide transition-colors " +
                    (section === s.id ? "bg-[#171717] text-white" : "text-[#7a7a7a] hover:bg-[#171717]/5")
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
              {section === "danger" && <DangerSection isPl={isPl} onDeleted={() => onOpenChange(false)} />}
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-[#171717]/10 pt-4">
              {isAdmin ? (
                <a href="/admin" className="text-[13px] font-bold underline hover:text-[#0f0f0f]">
                  {isPl ? "Zarządzaj kanałem" : "Manage channel"}
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
                className="text-[13px] font-bold text-red-600 hover:underline"
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
