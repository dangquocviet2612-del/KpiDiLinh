"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import useSWR from "swr";
import type { Customer, PaginatedResponse } from "@/types";
import { useDebounce } from "@/hooks/useDebounce";

export interface CustomerFilters {
  search: string;
  subscriberType: string;
  billingType: string;
  prepaidPeriod: string;
  ctvCode: string;
  expirationFilter: string;
  status: string;
}

interface UseCustomersOptions {
  fixedFilters?: Partial<CustomerFilters>;
}

const defaultFilters: CustomerFilters = {
  search: "",
  subscriberType: "",
  billingType: "",
  prepaidPeriod: "",
  ctvCode: "",
  expirationFilter: "",
  status: "",
};

const fetcher = async (url: string): Promise<PaginatedResponse<Customer>> => {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || "Không tải được danh sách khách hàng");
  }
  return res.json();
};

export function useCustomers(options: UseCustomersOptions = {}) {
  const { fixedFilters = {} } = options;

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filters, setFiltersState] = useState<CustomerFilters>({
    ...defaultFilters,
    ...fixedFilters,
  });

  const debouncedSearch = useDebounce(filters.search, 500);
  const debouncedSubscriberType = useDebounce(filters.subscriberType, 300);
  const debouncedBillingType = useDebounce(filters.billingType, 300);
  const debouncedPrepaidPeriod = useDebounce(filters.prepaidPeriod, 300);
  const debouncedCtvCode = useDebounce(filters.ctvCode, 300);
  const debouncedExpirationFilter = useDebounce(filters.expirationFilter, 300);
  const debouncedStatus = useDebounce(filters.status, 300);

  const apiUrl = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      search: debouncedSearch,
      subscriberType: debouncedSubscriberType,
      billingType: debouncedBillingType,
      prepaidPeriod: debouncedPrepaidPeriod,
      expirationFilter: debouncedExpirationFilter,
      status: debouncedStatus,
      includeTotal: "true",
    });
    if (debouncedCtvCode) params.set("ctvCode", debouncedCtvCode);
    return `/api/customers?${params.toString()}`;
  }, [
    page,
    limit,
    debouncedSearch,
    debouncedSubscriberType,
    debouncedBillingType,
    debouncedPrepaidPeriod,
    debouncedExpirationFilter,
    debouncedStatus,
    debouncedCtvCode,
  ]);

  const { data, error, isLoading, isValidating, mutate } = useSWR<PaginatedResponse<Customer>>(apiUrl, fetcher, {
    keepPreviousData: true,
    revalidateOnFocus: false,
    dedupingInterval: 10_000,
  });

  useEffect(() => {
    setSelectedIds([]);
  }, [page, limit, debouncedSearch, debouncedSubscriberType, debouncedBillingType, debouncedPrepaidPeriod, debouncedExpirationFilter, debouncedStatus, debouncedCtvCode]);

  const setFilter = useCallback(
    (key: keyof CustomerFilters, value: string) => {
      if (key in fixedFilters) return;
      setFiltersState((prev) => ({ ...prev, [key]: value }));
      setPage(1);
    },
    [fixedFilters]
  );

  const fetchCustomers = useCallback(async () => {
    await mutate();
  }, [mutate]);

  return {
    customers: data?.data || [],
    total: Number(data?.total || 0),
    page,
    setPage,
    totalPages: Number(data?.totalPages || 1),
    limit,
    setLimit: (newLimit: number) => {
      setLimit(newLimit);
      setPage(1);
    },
    loading: isLoading || (isValidating && !data),
    error: error ? String((error as Error).message || "Lỗi tải dữ liệu") : null,
    selectedIds,
    setSelectedIds,
    fetchCustomers,
    filters,
    setFilter,
  };
}
