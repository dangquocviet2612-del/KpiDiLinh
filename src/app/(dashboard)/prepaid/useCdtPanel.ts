"use client";

import type { ChangeEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  buildCdtExportFileName,
  buildCdtExportSuccessMessage,
  resolveCdtExportMonth,
} from "@/lib/cdt-export";
import { normalizeCdtAccountSearch } from "@/lib/cdt-account-search";

type CdtRow = {
  transactionDate: string;
  transactionTime?: string | null;
  ctvUser: string;
  subscriberType?: string | null;
  account: string;
  amount: number;
  months: number;
};

type CdtSummaryRow = {
  ctvUser: string;
  nvThucHien: string;
  ftth: number;
  ths: number;
  camera: number;
  total: number;
  totalAmount: number;
};

type CdtReportTotals = {
  count: number;
  totalAmount: number;
  totalMonths: number;
  ftth: number;
  ths: number;
  camera: number;
};

type CdtSummaryTotals = {
  ftth: number;
  ths: number;
  camera: number;
  total: number;
  totalAmount: number;
};

const formatDateToIso = (date: Date): string => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const getTodayIso = (): string => formatDateToIso(new Date());

const getFirstDayOfMonthIso = (): string => {
  const now = new Date();
  return formatDateToIso(new Date(now.getFullYear(), now.getMonth(), 1));
};

const formatIsoToVnDate = (value?: string | null): string => {
  if (!value) return "";
  const datePart = String(value).slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
  if (!match) return "";
  return `${match[3]}/${match[2]}/${match[1]}`;
};

type UseCdtPanelOptions = {
  canAdmin: boolean;
  canSelectCtv: boolean;
  canViewSummaryReport: boolean;
  enabledDetail: boolean;
  enabledSummary: boolean;
  hasSession: boolean;
};

export type CdtPanelController = {
  fromDate: string;
  toDate: string;
  accountFilter: string;
  selectedCtv: string;
  managerFilter: string;
  dateRangeLabel: string;
  activeMobileFilterCount: number;
  activeSummaryMobileFilterCount: number;
  showMobileFilters: boolean;
  showSummaryMobileFilters: boolean;
  loading: boolean;
  refreshing: boolean;
  importing: boolean;
  exportingMonth: boolean;
  reportErrorMessage: string | null;
  summaryErrorMessage: string | null;
  rows: CdtRow[];
  totals: CdtReportTotals;
  page: number;
  totalPages: number;
  summaryRows: CdtSummaryRow[];
  summaryTotals: CdtSummaryTotals;
  summaryPage: number;
  summaryTotalPages: number;
  setFromDate: (value: string) => void;
  setToDate: (value: string) => void;
  setAccountFilter: (value: string) => void;
  setSelectedCtv: (value: string) => void;
  setManagerFilter: (value: string) => void;
  setPage: (value: number | ((current: number) => number)) => void;
  setSummaryPage: (value: number | ((current: number) => number)) => void;
  toggleMobileFilters: () => void;
  toggleSummaryMobileFilters: () => void;
  closeSummaryMobileFilters: () => void;
  fetchReport: (options?: { fromOverride?: string; toOverride?: string; pageOverride?: number; force?: boolean }) => Promise<void>;
  fetchSummary: (options?: { force?: boolean }) => Promise<void>;
  handleImport: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleExportMonth: () => Promise<void>;
};

export default function useCdtPanel({
  canAdmin,
  canSelectCtv,
  canViewSummaryReport,
  enabledDetail,
  enabledSummary,
  hasSession,
}: UseCdtPanelOptions): CdtPanelController {
  const [fromDate, setFromDate] = useState(getFirstDayOfMonthIso());
  const [toDate, setToDate] = useState(getTodayIso());
  const [debouncedFromDate, setDebouncedFromDate] = useState(getFirstDayOfMonthIso());
  const [debouncedToDate, setDebouncedToDate] = useState(getTodayIso());
  const [accountFilter, setAccountFilter] = useState("");
  const [debouncedAccountFilter, setDebouncedAccountFilter] = useState("");
  const [rows, setRows] = useState<CdtRow[]>([]);
  const [totals, setTotals] = useState<CdtReportTotals>({
    count: 0,
    totalAmount: 0,
    totalMonths: 0,
    ftth: 0,
    ths: 0,
    camera: 0,
  });
  const [summaryRows, setSummaryRows] = useState<CdtSummaryRow[]>([]);
  const [summaryTotals, setSummaryTotals] = useState<CdtSummaryTotals>({
    ftth: 0,
    ths: 0,
    camera: 0,
    total: 0,
    totalAmount: 0,
  });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 60;
  const [summaryPage, setSummaryPage] = useState(1);
  const [summaryTotalPages, setSummaryTotalPages] = useState(1);
  const summaryPageSize = 40;
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exportingMonth, setExportingMonth] = useState(false);
  const [reportErrorMessage, setReportErrorMessage] = useState<string | null>(null);
  const [summaryErrorMessage, setSummaryErrorMessage] = useState<string | null>(null);
  const [selectedCtv, setSelectedCtv] = useState("");
  const [managerFilter, setManagerFilter] = useState("");
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [showSummaryMobileFilters, setShowSummaryMobileFilters] = useState(false);

  const reportReqRef = useRef(0);
  const summaryReqRef = useRef(0);
  const lastReportKeyRef = useRef("");
  const lastSummaryKeyRef = useRef("");
  const hasReportDataRef = useRef(false);
  const hasSummaryDataRef = useRef(false);
  const prevReportFilterKeyRef = useRef("");
  const prevSummaryFilterKeyRef = useRef("");

  useEffect(() => {
    const id = setTimeout(() => setDebouncedFromDate(fromDate), 320);
    return () => clearTimeout(id);
  }, [fromDate]);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedToDate(toDate), 320);
    return () => clearTimeout(id);
  }, [toDate]);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedAccountFilter(normalizeCdtAccountSearch(accountFilter)), 320);
    return () => clearTimeout(id);
  }, [accountFilter]);

  const fetchReport = useCallback(
    async (options?: {
      fromOverride?: string;
      toOverride?: string;
      pageOverride?: number;
      force?: boolean;
    }) => {
      if (!hasSession || !enabledDetail) return;
      const effectiveFrom =
        options?.fromOverride !== undefined ? options.fromOverride : debouncedFromDate;
      const effectiveTo =
        options?.toOverride !== undefined ? options.toOverride : debouncedToDate;
      const effectivePage = options?.pageOverride ?? page;
      const requestKey = [
        effectiveFrom || "",
        effectiveTo || "",
        debouncedAccountFilter || "",
        effectivePage,
        canSelectCtv ? selectedCtv : "",
        canAdmin ? managerFilter : "",
      ].join("|");
      if (!options?.force && hasReportDataRef.current && lastReportKeyRef.current === requestKey) {
        return;
      }
      lastReportKeyRef.current = requestKey;
      const reqId = ++reportReqRef.current;
      setReportErrorMessage(null);
      if (!hasReportDataRef.current) setLoading(true);
      else setRefreshing(true);
      try {
        const params = new URLSearchParams();
        if (effectiveFrom) params.set("from", effectiveFrom);
        if (effectiveTo) params.set("to", effectiveTo);
        if (debouncedAccountFilter) params.set("account", debouncedAccountFilter);
        params.set("page", String(Math.max(1, effectivePage)));
        params.set("pageSize", String(pageSize));
        if (canSelectCtv && selectedCtv) params.set("ctvUser", selectedCtv);
        if (canAdmin && managerFilter) params.set("managerCode", managerFilter);
        const res = await fetch(`/api/cdt/report?${params.toString()}`);
        const data = await res.json();
        if (reqId !== reportReqRef.current) return;
        if (!res.ok) throw new Error(data?.error || "Không tải được dữ liệu CDT");
        setReportErrorMessage(null);
        setRows(Array.isArray(data.rows) ? data.rows : []);
        setTotals(
          data?.totals || {
            count: 0,
            totalAmount: 0,
            totalMonths: 0,
            ftth: 0,
            ths: 0,
            camera: 0,
          }
        );
        hasReportDataRef.current = true;
        const nextTotalPages = Math.max(1, Number(data?.pagination?.totalPages || 1));
        const currentPage = Math.max(1, Number(data?.pagination?.page || effectivePage || 1));
        setTotalPages(nextTotalPages);
        if (currentPage !== page) setPage(currentPage);
        if (!effectiveFrom && data.from) setFromDate(String(data.from));
        if (!effectiveTo && data.to) setToDate(String(data.to));
      } catch (error: any) {
        if (reqId !== reportReqRef.current) return;
        const nextError = error?.message || "Không tải được dữ liệu CDT";
        setReportErrorMessage(nextError);
        toast.error(nextError);
        if (!hasReportDataRef.current) {
          setRows([]);
          setTotals({ count: 0, totalAmount: 0, totalMonths: 0, ftth: 0, ths: 0, camera: 0 });
          setTotalPages(1);
        }
      } finally {
        if (reqId === reportReqRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [canAdmin, canSelectCtv, debouncedAccountFilter, debouncedFromDate, debouncedToDate, enabledDetail, hasSession, managerFilter, page, selectedCtv]
  );

  const fetchSummary = useCallback(
    async (options?: { force?: boolean }) => {
      if (!hasSession || !enabledSummary || !canViewSummaryReport) return;
      const requestKey = [
        debouncedFromDate || "",
        debouncedToDate || "",
        summaryPage,
        canAdmin ? managerFilter : "",
      ].join("|");
      if (!options?.force && hasSummaryDataRef.current && lastSummaryKeyRef.current === requestKey) {
        return;
      }
      lastSummaryKeyRef.current = requestKey;
      const reqId = ++summaryReqRef.current;
      setSummaryErrorMessage(null);
      if (!hasSummaryDataRef.current) setLoading(true);
      else setRefreshing(true);
      try {
        const params = new URLSearchParams();
        if (debouncedFromDate) params.set("from", debouncedFromDate);
        if (debouncedToDate) params.set("to", debouncedToDate);
        params.set("page", String(Math.max(1, summaryPage)));
        params.set("pageSize", String(summaryPageSize));
        if (canAdmin && managerFilter) params.set("managerCode", managerFilter);
        const res = await fetch(`/api/cdt/summary?${params.toString()}`);
        const data = await res.json();
        if (reqId !== summaryReqRef.current) return;
        if (!res.ok) throw new Error(data?.error || "Không tải được báo cáo CDT");
        setSummaryErrorMessage(null);
        setSummaryRows(Array.isArray(data.rows) ? data.rows : []);
        setSummaryTotals(
          data?.totals || { ftth: 0, ths: 0, camera: 0, total: 0, totalAmount: 0 }
        );
        const nextTotalPages = Math.max(1, Number(data?.pagination?.totalPages || 1));
        const currentPage = Math.max(1, Number(data?.pagination?.page || summaryPage));
        setSummaryTotalPages(nextTotalPages);
        if (currentPage !== summaryPage) setSummaryPage(currentPage);
        hasSummaryDataRef.current = true;
      } catch (error: any) {
        if (reqId !== summaryReqRef.current) return;
        const nextError = error?.message || "Không tải được báo cáo CDT";
        setSummaryErrorMessage(nextError);
        toast.error(nextError);
        if (!hasSummaryDataRef.current) {
          setSummaryRows([]);
          setSummaryTotals({ ftth: 0, ths: 0, camera: 0, total: 0, totalAmount: 0 });
          setSummaryTotalPages(1);
        }
      } finally {
        if (reqId === summaryReqRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [canAdmin, canViewSummaryReport, debouncedFromDate, debouncedToDate, enabledSummary, hasSession, managerFilter, summaryPage]
  );

  const handleImport = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      setImporting(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/cdt/import", { method: "POST", body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Import CDT thất bại");
        toast.success(`Import CDT thành công (${data.validRows || 0} dòng hợp lệ)`);
        const nextFrom = getFirstDayOfMonthIso();
        const nextTo = getTodayIso();
        setFromDate(nextFrom);
        setToDate(nextTo);
        setPage(1);
        await fetchReport({ fromOverride: nextFrom, toOverride: nextTo, pageOverride: 1, force: true });
      } catch (error: any) {
        toast.error(error?.message || "Import CDT thất bại");
      } finally {
        setImporting(false);
        event.target.value = "";
      }
    },
    [fetchReport]
  );

  const handleExportMonth = useCallback(async () => {
    if (!canAdmin || exportingMonth) return;
    try {
      setExportingMonth(true);
      const month = resolveCdtExportMonth({ from: fromDate, to: toDate });
      const res = await fetch(`/api/cdt/export?month=${encodeURIComponent(month)}`);
      if (!res.ok) {
        let message = "Tải file CDT thất bại";
        try {
          const data = await res.json();
          message = data?.error || message;
        } catch {}
        throw new Error(message);
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = buildCdtExportFileName(month);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
      toast.success(buildCdtExportSuccessMessage(month));
    } catch (error: any) {
      toast.error(error?.message || "Tải file CDT thất bại");
    } finally {
      setExportingMonth(false);
    }
  }, [canAdmin, exportingMonth, fromDate, toDate]);

  const toggleMobileFilters = useCallback(() => {
    setShowMobileFilters((current) => !current);
  }, []);

  const toggleSummaryMobileFilters = useCallback(() => {
    setShowSummaryMobileFilters((current) => !current);
  }, []);

  const closeSummaryMobileFilters = useCallback(() => {
    setShowSummaryMobileFilters(false);
  }, []);

  useEffect(() => {
    if (!hasSession || !enabledSummary) return;
    const nextKey = [debouncedFromDate, debouncedToDate, canAdmin ? managerFilter : ""].join("|");
    const filtersChanged =
      prevSummaryFilterKeyRef.current !== "" && prevSummaryFilterKeyRef.current !== nextKey;
    prevSummaryFilterKeyRef.current = nextKey;
    if (filtersChanged && summaryPage !== 1) return;
    void fetchSummary();
  }, [canAdmin, debouncedFromDate, debouncedToDate, enabledSummary, fetchSummary, hasSession, managerFilter, summaryPage]);

  useEffect(() => {
    if (!hasSession || !enabledDetail) return;
    const nextKey = [
      debouncedFromDate,
      debouncedToDate,
      debouncedAccountFilter,
      canSelectCtv ? selectedCtv : "",
      canAdmin ? managerFilter : "",
    ].join("|");
    const filtersChanged =
      prevReportFilterKeyRef.current !== "" && prevReportFilterKeyRef.current !== nextKey;
    prevReportFilterKeyRef.current = nextKey;
    if (filtersChanged && page !== 1) return;
    void fetchReport();
  }, [canAdmin, canSelectCtv, debouncedAccountFilter, debouncedFromDate, debouncedToDate, enabledDetail, fetchReport, hasSession, managerFilter, page, selectedCtv]);

  useEffect(() => {
    setPage(1);
  }, [debouncedAccountFilter, debouncedFromDate, debouncedToDate, managerFilter, selectedCtv]);

  useEffect(() => {
    setSummaryPage(1);
  }, [debouncedFromDate, debouncedToDate, managerFilter]);

  const dateRangeLabel = useMemo(() => {
    const from = formatIsoToVnDate(fromDate) || "--/--/----";
    const to = formatIsoToVnDate(toDate) || "--/--/----";
    return `${from} - ${to}`;
  }, [fromDate, toDate]);

  const activeMobileFilterCount = useMemo(() => {
    let count = 0;
    if (accountFilter.trim()) count += 1;
    if (selectedCtv) count += 1;
    if (managerFilter) count += 1;
    return count;
  }, [accountFilter, managerFilter, selectedCtv]);

  const activeSummaryMobileFilterCount = useMemo(() => {
    let count = 0;
    if (managerFilter) count += 1;
    return count;
  }, [managerFilter]);

  return {
    fromDate,
    toDate,
    accountFilter,
    selectedCtv,
    managerFilter,
    dateRangeLabel,
    activeMobileFilterCount,
    activeSummaryMobileFilterCount,
    showMobileFilters,
    showSummaryMobileFilters,
    loading,
    refreshing,
    importing,
    exportingMonth,
    reportErrorMessage,
    summaryErrorMessage,
    rows,
    totals,
    page,
    totalPages,
    summaryRows,
    summaryTotals,
    summaryPage,
    summaryTotalPages,
    setFromDate,
    setToDate,
    setAccountFilter,
    setSelectedCtv,
    setManagerFilter,
    setPage,
    setSummaryPage,
    toggleMobileFilters,
    toggleSummaryMobileFilters,
    closeSummaryMobileFilters,
    fetchReport,
    fetchSummary,
    handleImport,
    handleExportMonth,
  };
}
