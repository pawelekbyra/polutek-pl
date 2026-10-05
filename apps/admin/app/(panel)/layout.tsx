import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getShellStatus } from "@/lib/modules/admin-overview";
import { AppShell } from "@admin/components/shell/app-shell";
import { TranslatorShell } from "@admin/components/shell/translator-shell";
import type { ShellHealth } from "@admin/components/shell/topbar";
import { requireAdmin } from "@admin/lib/auth/guard";
import { safeNextPath } from "@admin/lib/auth/session-rules";
import { overviewDeps, usesSampleData } from "@admin/lib/overview";

/**
 * Every screen of the panel: signed-in admin only (layer 2: Access token in access mode, passkey session in legacy mode), then the shell with the badges and
 * the health dot read on the server. No loading.tsx anywhere: the page arrives complete.
 * A TRANSLATOR gets the small translator shell (and the proxy keeps them on /tlumaczenia); owners get the full one.
 */
export default async function PanelLayout({ children }: { children: ReactNode }) {
  const path = safeNextPath((await headers()).get("x-panel-path"));
  const viewer = await requireAdmin(path, { roles: ["OWNER", "TRANSLATOR"] });
  if (viewer.role === "TRANSLATOR") {
    if (!path.startsWith("/tlumaczenia")) redirect("/tlumaczenia");
    return (
      <TranslatorShell name={viewer.name} email={viewer.email} languages={viewer.languages} signOutHref={viewer.signOutHref}>
        {children}
      </TranslatorShell>
    );
  }
  const { nav, health } = await getShellStatus(overviewDeps());
  const shellHealth: ShellHealth = {
    kind: health.kind,
    word: health.word,
    headline: health.headline,
    okCount: health.counts.ok,
    items: health.checks.map((c) => ({ kind: c.kind, label: c.label, detail: c.detail })),
  };
  return (
    <AppShell
      counts={nav}
      health={shellHealth}
      viewer={{ name: viewer.name, email: viewer.email, dev: viewer.dev, signOutHref: viewer.signOutHref }}
      sample={usesSampleData()}
      now={health.measuredAt}
    >
      {children}
    </AppShell>
  );
}
