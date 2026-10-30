"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import useSWR from "swr";
import type { Customer, PaginatedResponse } from "@/types";
import { useDebounce } from "@/hooks/useDebounce";
import { useCustomerQueryState, type CustomerQueryOptions } from "@/hooks/useCustomerQueryState";

export type { CustomerFilters } from "@/lib/customer-query-state";

function useRestorableFilter(value: string, delay: number, revision: number, restored: string) {
  const input = useMemo(() => ({ value, revision }), [value, revision]);
  const debounced = useDebounce(input, delay);
  return debounced.revision === revision ? debounced.value : restored;
}

const fetcher = async (url: string): Promise<PaginatedResponse<Customer>> => {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || "Không tải được danh sách khách hàng");
  }
  return res.json();
};

export function useCustomers(options: CustomerQueryOptions = {}) {
  const { page, setPage, limit, setLimit, filters, setFilter, ready, revision, restoredFilters, commitUrl } = useCustomerQueryState(options);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const debouncedSearch = useRestorableFilter(filters.search, 500, revision, restoredFilters.search);
  const debouncedSubscriberType = useRestorableFilter(filters.subscriberType, 300, revision, restoredFilters.subscriberType);
  const debouncedBillingType = useRestorableFilter(filters.billingType, 300, revision, restoredFilters.billingType);
  const debouncedPrepaidPeriod = useRestorableFilter(filters.prepaidPeriod, 300, revision, restoredFilters.prepaidPeriod);
  const debouncedCtvCode = useRestorableFilter(filters.ctvCode, 300, revision, restoredFilters.ctvCode);
  const debouncedExpirationFilter = useRestorableFilter(filters.expirationFilter, 300, revision, restoredFilters.expirationFilter);
  const debouncedStatus = useRestorableFilter(filters.status, 300, revision, restoredFilters.status);

  const filtersPending = filters.search !== debouncedSearch
    || filters.subscriberType !== debouncedSubscriberType
    || filters.billingType !== debouncedBillingType
    || filters.prepaidPeriod !== debouncedPrepaidPeriod
    || filters.ctvCode !== debouncedCtvCode
    || filters.expirationFilter !== debouncedExpirationFilter
    || filters.status !== debouncedStatus;

  useEffect(() => { if (!filtersPending) commitUrl(); }, [commitUrl, filtersPending]);

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

  const { data, error, isLoading, isValidating, mutate } = useSWR<PaginatedResponse<Customer>>(ready ? apiUrl : null, fetcher, {
    keepPreviousData: true,
    revalidateOnFocus: false,
    dedupingInterval: 10_000,
  });

  useEffect(() => {
    setSelectedIds([]);
  }, [page, limit, debouncedSearch, debouncedSubscriberType, debouncedBillingType, debouncedPrepaidPeriod, debouncedExpirationFilter, debouncedStatus, debouncedCtvCode]);

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
    setLimit,
    loading: !data && (!ready || isLoading || isValidating || filtersPending),
    refreshing: Boolean(data) && (isValidating || filtersPending),
    hasData: Boolean(data),
    error: error ? String((error as Error).message || "Lỗi tải dữ liệu") : null,
    selectedIds,
    setSelectedIds,
    fetchCustomers,
    filters,
    setFilter,
  };
}
