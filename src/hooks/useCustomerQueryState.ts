"use client";

import { useCallback, useEffect, useRef, useState, type SetStateAction } from "react";
import { defaultCustomerFilters, parseCustomerQuery, serializeCustomerQuery, type CustomerFilters, type CustomerQueryState } from "@/lib/customer-query-state";

export interface CustomerQueryOptions {
  fixedFilters?: Partial<CustomerFilters>;
  syncUrl?: boolean;
}

interface QuerySnapshot extends CustomerQueryState {
  ready: boolean;
  revision: number;
  restoredFilters: CustomerFilters;
  source: "initial" | "history" | "user";
}

const emptyFixedFilters: Partial<CustomerFilters> = {};

export function useCustomerQueryState({ fixedFilters = emptyFixedFilters, syncUrl = false }: CustomerQueryOptions) {
  const fixedFiltersRef = useRef(fixedFilters);
  const [query, setQuery] = useState<QuerySnapshot>(() => {
    const filters = { ...defaultCustomerFilters, ...fixedFilters };
    return { page: 1, limit: 10, filters, restoredFilters: filters, ready: !syncUrl, revision: 0, source: "initial" };
  });

  useEffect(() => { fixedFiltersRef.current = fixedFilters; }, [fixedFilters]);

  useEffect(() => {
    if (!syncUrl) return;
    const restore = () => {
      if (window.location.pathname !== "/customers") {
        setQuery((current) => current.ready ? current : { ...current, ready: true });
        return;
      }
      const restored = parseCustomerQuery(window.location.search, fixedFiltersRef.current);
      setQuery((current) => ({ ...restored, ready: true, source: "history", revision: current.revision + 1, restoredFilters: restored.filters }));
    };
    restore(); window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, [syncUrl]);

  const setPage = useCallback((page: SetStateAction<number>) => {
    setQuery((current) => {
      const next = typeof page === "function" ? page(current.page) : page;
      return next === current.page ? current : { ...current, page: next, source: "user" };
    });
  }, []);

  const setLimit = useCallback((limit: number) => {
    setQuery((current) => current.limit === limit && current.page === 1 ? current : { ...current, limit, page: 1, source: "user" });
  }, []);

  const setFilter = useCallback((key: keyof CustomerFilters, value: string) => {
    if (key in fixedFilters) return;
    setQuery((current) => current.filters[key] === value && current.page === 1 ? current : { ...current, filters: { ...current.filters, [key]: value }, page: 1, source: "user" });
  }, [fixedFilters]);

  const commitUrl = useCallback(() => {
    if (!syncUrl || !query.ready || query.source !== "user" || window.location.pathname !== "/customers") return;
    const current = new URL(window.location.href); const next = serializeCustomerQuery(current, query);
    if (next === current.pathname + current.search + current.hash) return;
    try { window.history.pushState(null, "", next); } catch { return; }
  }, [query, syncUrl]);

  return { ...query, setPage, setLimit, setFilter, commitUrl };
}
