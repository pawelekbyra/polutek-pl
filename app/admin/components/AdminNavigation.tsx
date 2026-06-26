import Link from "next/link";
import { ArrowLeft } from "@/app/components/icons";
import { Button } from "@/components/ui/button";

type AdminBreadcrumb = {
  label: string;
  href: string;
};

type AdminNavigationProps = {
  items: AdminBreadcrumb[];
  backHref: string;
  backLabel: string;
  ariaLabel?: string;
  className?: string;
};

export function AdminNavigation({
  items,
  backHref,
  backLabel,
  ariaLabel = "Nawigacja administracyjna",
  className = "mb-6",
}: AdminNavigationProps) {
  return (
    <nav aria-label={ariaLabel} className={className}>
      <ol className="mb-2 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li key={`${item.href}-${item.label}`} className="flex items-center gap-2">
              {index > 0 && <span aria-hidden="true">/</span>}
              {isLast ? (
                <span aria-current="page" className="text-foreground">
                  {item.label}
                </span>
              ) : (
                <Link href={item.href} className="transition-colors hover:text-foreground">
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
      <Button variant="ghost" asChild className="-ml-3 h-8 px-2">
        <Link href={backHref} aria-label={backLabel}>
          <ArrowLeft className="mr-2 h-4 w-4" /> {backLabel}
        </Link>
      </Button>
    </nav>
  );
}
