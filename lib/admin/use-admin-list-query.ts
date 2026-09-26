"use client";

import { useCallback, useState } from "react";
import { readAdminApiError } from "@/lib/admin/api-error";

export interface AdminListQueryResult<TItem> {
  items: TItem[];
  setItems: React.Dispatch<React.SetStateAction<TItem[]>>;
  total: number;
  page: number;
  totalPages: number;
  isLoading: boolean;
  error: string | null;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  /**
   * Fetches one page of a list endpoint shaped like `{ items, total, page, totalPages, ...rest }`,
   * updating the shared page/total/totalPages/isLoading/error state. Returns the raw parsed
   * response body on success so callers can pull out page-specific extra fields (stats, summary, ...).
   */
  fetchPage: (url: string, targetPage: number, options?: { fallbackMessage?: string }) => Promise<
    { ok: true; data: any } | { ok: false }
  >;
}

/**
 * Shared list/pagination/fetch scaffold for admin list pages (users, comments,
 * comments/reports, videos). Callers keep their own filter state and build their
 * own request URL; this hook only owns the page/total/totalPages/items/isLoading/error
 * bookkeeping and the try/catch/error-message boilerplate that used to be duplicated
 * across each page. See CLAUDE.md §5.1 and ADMIN-LIST-SCAFFOLD-CONSOLIDATION-001.
 */
export function useAdminListQuery<TItem>(): AdminListQueryResult<TItem> {
  const [items, setItems] = useState<TItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(async (url: string, targetPage: number, options?: { fallbackMessage?: string }) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(url);
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setItems(Array.isArray(data?.items) ? data.items : []);
        setTotal(data?.total ?? 0);
        setTotalPages(data?.totalPages ?? 0);
        setPage(data?.page ?? targetPage);
        return { ok: true as const, data };
      }
      setError(readAdminApiError(data, options?.fallbackMessage ?? "Nie udało się pobrać listy."));
      return { ok: false as const };
    } catch {
      setError("Wystąpił błąd połączenia z serwerem.");
      return { ok: false as const };
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { items, setItems, total, page, totalPages, isLoading, error, setError, fetchPage };
}
