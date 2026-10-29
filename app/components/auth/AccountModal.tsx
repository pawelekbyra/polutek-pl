"use client";

import React, { useLayoutEffect, useState } from "react";
import { Bell, Check, ChevronDown, HeartHandshake, KeyRound, Link2, LogOut, Mail, Shield, SlidersHorizontal, Trash2, UserRound, type LucideIcon } from "lucide-react";
import { Select } from "@base-ui/react/select";
import { Tabs } from "@base-ui/react/tabs";
import { ADMIN_PANEL_ORIGIN } from "@/lib/admin-legacy-redirects";
import { useAuth, useUser } from "@/lib/auth/react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
      <DialogContent className="flex max-h-[calc(100dvh-12px)] w-[min(920px,calc(100vw-24px))] max-w-none flex-col gap-0 overflow-hidden rounded-3xl border border-[var(--chan-line)] bg-[var(--chan-card)] p-0 text-[var(--chan-ink)] shadow-[0_28px_90px_-30px_rgba(15,23,42,0.4)] sm:max-h-[calc(100dvh-24px)] sm:max-w-none">
        <DialogHeader className="relative flex-none border-b border-[var(--chan-line)] px-5 py-3 pr-16 sm:px-8 sm:py-6">
          <DialogTitle className="font-brand text-[23px] font-bold leading-tight tracking-tight text-[var(--chan-ink)] sm:text-[26px]">
            {tx("Moje konto", "My account")}
          </DialogTitle>
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
            <div className="flex-none border-b border-[var(--chan-blue)]/20 bg-[var(--chan-blue-soft)]/75 px-4 py-1.5 md:hidden">
              <p className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--chan-blue)]">
                <SlidersHorizontal className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
                {tx("Wybierz sekcję", "Choose a section")}
              </p>
              <Select.Root value={section} onValueChange={(value) => value && setSection(value as Section)}>
                <Select.Trigger
                  aria-label={tx("Sekcja konta", "Account section")}
                  className="flex h-11 w-full items-center justify-between gap-3 rounded-xl border border-[var(--chan-blue)]/30 bg-[var(--chan-blue-soft)] px-3.5 text-left text-[13px] font-semibold text-[var(--chan-ink)] shadow-[0_2px_8px_rgba(37,99,235,0.08)] outline-none transition-colors hover:border-[var(--chan-blue)]/55 hover:bg-[var(--chan-blue-soft)] focus-visible:border-[var(--chan-blue)] focus-visible:ring-2 focus-visible:ring-[var(--chan-blue)]/20"
                >
                  <Select.Value>
                    {(value: Section | null) => {
                      const selected = sections.find((item) => item.id === value);
                      if (!selected) return null;
                      const Icon = selected.icon;
                      return <span className="flex min-w-0 items-center gap-2.5"><Icon className={`h-4 w-4 shrink-0 ${selected.danger ? "text-red-600" : "text-[var(--chan-blue)]"}`} strokeWidth={1.8} aria-hidden="true" /><span className="truncate">{selected.label}</span></span>;
                    }}
                  </Select.Value>
                  <Select.Icon><ChevronDown className="h-4 w-4 shrink-0 text-[var(--chan-muted)]" aria-hidden="true" /></Select.Icon>
                </Select.Trigger>
                <Select.Portal>
                  <Select.Positioner side="bottom" sideOffset={6} align="start" alignItemWithTrigger={false} className="z-[1200] w-[var(--anchor-width)]">
                    <Select.Popup className="max-h-(--available-height) overflow-hidden rounded-2xl border border-[var(--chan-blue)]/20 bg-[var(--chan-surface)] p-1 text-[var(--chan-ink)] shadow-[0_20px_50px_rgba(15,23,42,0.2)]">
                      <Select.List className="max-h-[min(60dvh,420px)] overflow-y-auto overscroll-contain">
                        {sections.map(({ id, label, icon: Icon, danger }) => (
                          <Select.Item
                            key={id}
                            value={id}
                            label={label}
                            className={`group flex min-h-10 cursor-pointer items-center gap-3 rounded-xl px-3 text-[13px] font-semibold outline-none data-highlighted:bg-[var(--chan-card)] ${danger ? "text-red-600 data-highlighted:bg-red-50 data-selected:bg-red-50" : "text-[var(--chan-muted)] data-selected:bg-[var(--chan-card)] data-selected:text-[var(--chan-blue)] data-selected:shadow-sm"}`}
                          >
                            <Icon className="h-[17px] w-[17px] shrink-0" strokeWidth={1.8} aria-hidden="true" />
                            <Select.ItemText className="min-w-0 flex-1 truncate">{label}</Select.ItemText>
                            <Select.ItemIndicator><Check className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" /></Select.ItemIndicator>
                          </Select.Item>
                        ))}
                      </Select.List>
                    </Select.Popup>
                  </Select.Positioner>
                </Select.Portal>
              </Select.Root>
            </div>

            <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-4 py-2 sm:px-7 sm:py-6">
              {sections.map(({ id, label }) => (
                <Tabs.Panel key={id} value={id} aria-label={label} className="min-w-0 outline-none">
                  {section === id ? (
                    <>
                      <h2 className={`${section === "profile" ? "mb-1" : "mb-5"} font-brand text-[18px] font-bold tracking-tight text-[var(--chan-ink)]`}>{label}</h2>
                      {panel(id)}
                    </>
                  ) : null}
                </Tabs.Panel>
              ))}
            </main>
          </div>
        </Tabs.Root>

        <div className="flex flex-none items-center justify-between gap-4 border-t border-[var(--chan-line)] bg-[var(--chan-surface)]/45 px-4 py-2 sm:px-8 sm:py-3.5">
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
