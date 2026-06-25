import Link from "next/link";
import { ArrowLeft } from "@/app/components/icons";
import { Button } from "@/components/ui/button";

export type AdminBreadcrumbItem = {
  label: string;
  href?: string;
};

type AdminBreadcrumbsProps = {
  items: AdminBreadcrumbItem[];
  backHref?: string;
  backLabel?: string;
  className?: string;
};

export function AdminBreadcrumbs({
  items,
  backHref,
  backLabel,
  className = "mb-6",
}: AdminBreadcrumbsProps) {
  const resolvedBackHref = backHref ?? items.at(-2)?.href ?? "/admin";
  const resolvedBackLabel = backLabel ?? (items.length > 1 ? `Wróć do ${items.at(-2)?.label.toLowerCase()}` : "Wróć do panelu");

  return (
    <nav className={className} aria-label="Ścieżka administracyjna">
      <Button variant="ghost" asChild className="-ml-3 mb-2 h-8 px-2 text-muted-foreground hover:text-foreground">
        <Link href={resolvedBackHref}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {resolvedBackLabel}
        </Link>
      </Button>
      <ol className="flex flex-wrap items-center gap-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1">
              {index > 0 && <span aria-hidden="true" className="text-muted-foreground/60">/</span>}
              {item.href && !isLast ? (
                <Link href={item.href} className="transition hover:text-foreground">
                  {item.label}
                </Link>
              ) : (
                <span aria-current={isLast ? "page" : undefined} className={isLast ? "text-foreground" : undefined}>
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function AdminBackLink(props: Omit<AdminBreadcrumbsProps, "items"> & { label?: string }) {
  return (
    <AdminBreadcrumbs
      items={[{ label: "Admin", href: "/admin" }]}
      backHref={props.backHref ?? "/admin"}
      backLabel={props.label ?? props.backLabel ?? "Wróć do panelu"}
      className={props.className}
    />
  );
}
