export type SidebarSortable = {
  id: string;
  slug?: string | null;
  sidebarOrder?: number | null;
  publishedAt?: Date | string | null;
  createdAt?: Date | string | null;
};

export function normalizeSidebarOrder(order: number | null | undefined): number {
  return typeof order === "number" && order > 0
    ? order
    : Number.MAX_SAFE_INTEGER;
}

function dateTime(value: Date | string | null | undefined): number {
  return value ? new Date(value).getTime() : 0;
}

export function compareSidebarItems<T extends SidebarSortable>(a: T, b: T): number {
  const orderDiff = normalizeSidebarOrder(a.sidebarOrder) - normalizeSidebarOrder(b.sidebarOrder);
  if (orderDiff !== 0) return orderDiff;

  const publishedDiff = dateTime(b.publishedAt) - dateTime(a.publishedAt);
  if (publishedDiff !== 0) return publishedDiff;

  const createdDiff = dateTime(b.createdAt) - dateTime(a.createdAt);
  if (createdDiff !== 0) return createdDiff;

  return (a.slug || a.id).localeCompare(b.slug || b.id);
}
