"use client";

import React, { useLayoutEffect, useState } from "react";
import { Bell, ChevronDown, HeartHandshake, KeyRound, Link2, LogOut, Mail, Shield, Trash2, UserRound, type LucideIcon } from "lucide-react";
import { Tabs } from "@base-ui/react/tabs";
import { ADMIN_PANEL_ORIGIN } from "@/lib/admin-legacy-redirects";
import { useAuth, useUser } from "@/lib/auth/react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLanguage } from "../LanguageContext";
import { ProfileSection } from "./ProfileSection";
import { EmailSection, ConnectionsSection, DangerSection } from "./AccountSections";
import { SecuritySection } from "./SecuritySection";
import { PasskeysSection } from "./PasskeysSection";
import { NotificationsSection } from "./NotificationsSection";
import { PassAccountSection } from "../premium-pass/PassAccountSection"; // patron zone (docs/architecture/patron-zone.md)
import { usePremiumPassStatus } from "../premium-pass/usePremiumPass"; // patron zone

type Section = "profile" | "notifications" | "email" | "connections" | "security" | "passkeys" | "danger" | "pass";

interface AccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAdmin: boolean;
  initialSection?: Section;
}

type AccountSection = { id: Section; label: string; icon: LucideIcon; danger?: boolean };

export default function AccountModal({ open, onOpenChange, isAdmin, initialSection = "profile" }: AccountModalProps) {
  const { user } = useUser();
  const { signOut } = useAuth();
  const { tx } = useLanguage();
  const [section, setSection] = useState<Section>(initialSection);
  const pass = usePremiumPassStatus(open); // patron zone: null when the patron zone is invisible (404)

  useLayoutEffect(() => {
    if (open) setSection(initialSection);
  }, [open, initialSection]);

  if (!user) return null;

  const sections: AccountSection[] = [
    { id: "profile", label: tx("Profil", "Profile"), icon: UserRound },
    { id: "notifications", label: tx("Powiadomienia", "Notifications"), icon: Bell },
    { id: "email", label: tx("E-mail", "Email"), icon: Mail },
    { id: "connections", label: tx("Konta", "Connections"), icon: Link2 },
    { id: "security", label: tx("Hasło", "Security"), icon: Shield },
    { id: "passkeys", label: tx("Klucze dostępu", "Passkeys"), icon: KeyRound },
    ...(pass.status ? [{ id: "pass" as const, label: tx("Strefa patrona", "Patron zone"), icon: HeartHandshake }] : []),
    { id: "danger", label: tx("Usuń konto", "Delete account"), icon: Trash2, danger: true },
  ];

  const panel = (id: Section) => {
    if (id === "profile") return <ProfileSection tx={tx} />;
    if (id === "notifications") return <NotificationsSection tx={tx} />;
    if (id === "email") return <EmailSection tx={tx} />;
    if (id === "connections") return <ConnectionsSection tx={tx} />;
    if (id === "security") return <SecuritySection tx={tx} />;
    if (id === "passkeys") return <PasskeysSection tx={tx} />;
    if (id === "danger") return <DangerSection tx={tx} onDeleted={() => onOpenChange(false)} />;
    if (id === "pass" && pass.status) return <PassAccountSection tx={tx} status={pass.status} />;
    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-24px)] w-[min(920px,calc(100vw-24px))] max-w-none flex-col gap-0 overflow-hidden rounded-3xl border border-[var(--chan-line)] bg-[var(--chan-card)] p-0 text-[var(--chan-ink)] shadow-[0_28px_90px_-30px_rgba(15,23,42,0.4)] sm:max-w-none">
        <DialogHeader className="relative flex-none border-b border-[var(--chan-line)] px-5 py-5 pr-16 sm:px-8 sm:py-6">
          <DialogTitle className="font-brand text-[23px] font-bold leading-tight tracking-tight text-[var(--chan-ink)] sm:text-[26px]">
            {tx("Moje konto", "My account")}
          </DialogTitle>
          <DialogDescription className="max-w-xl text-[13px] leading-relaxed text-[var(--chan-muted)]">
            {tx("Zarządzaj profilem, językiem i bezpieczeństwem konta.", "Manage your profile, language and account security.")}
          </DialogDescription>
        </DialogHeader>

        <Tabs.Root
          value={section}
          onValueChange={(value) => setSection(value as Section)}
          orientation="vertical"
          className="grid min-h-0 min-w-0 flex-1 grid-cols-1 md:grid-cols-[212px_minmax(0,1fr)]"
        >
          <Tabs.List activateOnFocus aria-label={tx("Sekcje konta", "Account sections")} className="hidden min-h-0 flex-col gap-1 overflow-y-auto border-r border-[var(--chan-line)] p-4 md:flex">
            {sections.map(({ id, label, icon: Icon, danger }) => (
              <Tabs.Tab
                key={id}
                value={id}
                className={
                  "group relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-left text-[13px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--chan-blue)] " +
                  (danger
                    ? "text-red-600 hover:bg-red-50 data-active:bg-red-50 data-active:text-red-700"
                    : "text-[var(--chan-muted)] hover:bg-[var(--chan-surface)] hover:text-[var(--chan-ink)] data-active:bg-[var(--chan-blue-soft)] data-active:text-[var(--chan-blue)]")
                }
              >
                <Icon className="h-[17px] w-[17px] shrink-0 opacity-75 group-data-[active]:opacity-100" strokeWidth={1.8} aria-hidden="true" />
                <span className="min-w-0 truncate">{label}</span>
                <span aria-hidden="true" className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-[var(--chan-blue)] opacity-0 group-data-[active]:opacity-100" />
              </Tabs.Tab>
            ))}
          </Tabs.List>

          <div className="flex min-h-0 min-w-0 flex-col overflow-hidden">
            <div className="flex-none border-b border-[var(--chan-line)] px-5 py-3 md:hidden">
              <label htmlFor="account-section-select" className="sr-only">{tx("Sekcja konta", "Account section")}</label>
              <div className="relative">
                <select
                  id="account-section-select"
                  value={section}
                  onChange={(event) => setSection(event.target.value as Section)}
                  className="h-11 w-full appearance-none rounded-xl border border-[var(--chan-line)] bg-[var(--chan-card)] pl-3.5 pr-11 text-[13px] font-semibold text-[var(--chan-ink)] outline-none transition-colors focus:border-[var(--chan-blue)] focus:ring-2 focus:ring-[var(--chan-blue)]/20"
                >
                  {sections.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--chan-muted)]" aria-hidden="true" />
              </div>
            </div>

            <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-7 sm:py-6">
              {sections.map(({ id, label }) => (
                <Tabs.Panel key={id} value={id} aria-label={label} className="min-w-0 outline-none">
                  {section === id ? (
                    <>
                      <h2 className="mb-5 font-brand text-[18px] font-bold tracking-tight text-[var(--chan-ink)]">{label}</h2>
                      {panel(id)}
                    </>
                  ) : null}
                </Tabs.Panel>
              ))}
            </main>
          </div>
        </Tabs.Root>

        <div className="flex flex-none items-center justify-between gap-4 border-t border-[var(--chan-line)] bg-[var(--chan-surface)]/45 px-5 py-3.5 sm:px-8">
          {isAdmin ? (
            <a href={ADMIN_PANEL_ORIGIN} target="_blank" rel="noopener noreferrer" className="rounded-lg px-2 py-1.5 text-[12px] font-bold text-[var(--chan-muted)] underline decoration-[var(--chan-line)] underline-offset-4 transition-colors hover:text-[var(--chan-blue)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-blue)]">
              {tx("Panel admina", "Admin panel")}
            </a>
          ) : <span />}
          <button
            type="button"
            onClick={() => { onOpenChange(false); void signOut(); }}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-[12px] font-semibold text-[var(--chan-muted)] transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
            {tx("Wyloguj się", "Sign out")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
