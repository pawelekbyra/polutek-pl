import Link from "next/link";
import { ArrowLeft } from "@/app/components/icons";
import { Button } from "@/components/ui/button";

export type AdminNavigationCrumb = {
  href: string;
  label: string;
};

type AdminNavigationProps = {
  backHref: string;
  backLabel: string;
  currentLabel: string;
  breadcrumbs?: AdminNavigationCrumb[];
  className?: string;
};

export function AdminNavigation({
  backHref,
  backLabel,
  currentLabel,
  breadcrumbs = [],
  className = "mb-6",
}: AdminNavigationProps) {
  return (
    <nav aria-label="Nawigacja administracyjna" className={className}>
      <Button variant="ghost" asChild className="-ml-3 h-8 px-2">
        <Link href={backHref} aria-label={backLabel}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {backLabel}
        </Link>
      </Button>
      <ol aria-label="Ścieżka administracyjna" className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <li>
          <Link href="/admin" className="hover:text-foreground">
            Panel admina
          </Link>
        </li>
        {breadcrumbs.map((crumb) => (
          <li key={`${crumb.href}-${crumb.label}`} className="flex items-center gap-2">
            <span aria-hidden="true">/</span>
            <Link href={crumb.href} className="hover:text-foreground">
              {crumb.label}
            </Link>
          </li>
        ))}
        <li className="flex items-center gap-2 font-medium text-foreground" aria-current="page">
          <span aria-hidden="true">/</span>
          <span>{currentLabel}</span>
        </li>
      </ol>
    </nav>
  );
}
