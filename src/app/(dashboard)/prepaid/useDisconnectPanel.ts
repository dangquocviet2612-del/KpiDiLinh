"use client";

import type { ChangeEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { normalizeCdtAccountSearch } from "@/lib/cdt-account-search";
import {
  DISCONNECT_SOURCE_TV,
  type DisconnectSourceType,
  formatDisconnectReportMonthLabel,
  getDisconnectSourceLabel,
  normalizeDisconnectReportMonth,
  normalizeDisconnectSourceType,
} from "@/lib/disconnect";

const TEXT = {
  loadFailed: "Không tải được dữ liệu rời mạng",
  invalidReportMonth: "Kỳ file không hợp lệ",
  importFailed: "Import rời mạng thất bại",
  importSuccess: "Import rời mạng thành công",
  downloadTemplateFailed: "Tải file mẫu rời mạng thất bại",
  downloadTemplateSuccess: "Đã tải file mẫu rời mạng",
  reportMonthPlaceholder: "Chưa chọn kỳ file",
} as const;

type DisconnectRow = {
  id: number;
  reportMonth: string;
  sourceType: string;
  account: string;
  serviceName?: string | null;
  ctvCode: string;
  suspendedDateIso?: string | null;
  suspendedDateText?: string | null;
  cancelDateIso?: string | null;
  cancelDateText?: string | null;
  cancelMonth: string;
};

type DisconnectTotals = {
  total: number;
  upcoming: number;
  overdue: number;
};

type UseDisconnectPanelOptions = {
  canAdmin: boolean;
  canSelectCtv: boolean;
  enabled: boolean;
  hasSession: boolean;
};

export type DisconnectPanelController = {
  reportMonth: string;
  cancelMonth: string;
  sourceFilter: string;
  importSourceType: DisconnectSourceType;
  accountFilter: string;
  selectedCtv: string;
  managerFilter: string;
  availableReportMonths: string[];
  availableCancelMonths: string[];
  reportMonthLabel: string;
  activeMobileFilterCount: number;
  showMobileFilters: boolean;
  loading: boolean;
  refreshing: boolean;
  importing: boolean;
  downloadingTemplate: boolean;
  errorMessage: string | null;
  rows: DisconnectRow[];
  totals: DisconnectTotals;
  page: number;
  totalPages: number;
  setReportMonth: (value: string) => void;
  setCancelMonth: (value: string) => void;
  setSourceFilter: (value: string) => void;
  setImportSourceType: (value: DisconnectSourceType) => void;
  setAccountFilter: (value: string) => void;
  setSelectedCtv: (value: string) => void;
  setManagerFilter: (value: string) => void;
  setPage: (value: number | ((current: number) => number)) => void;
  toggleMobileFilters: () => void;
  fetchReport: (options?: {
    force?: boolean;
    reportMonthOverride?: string;
    pageOverride?: number;
    sourceTypeOverride?: string;
  }) => Promise<void>;
  handleImport: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleDownloadTemplate: () => Promise<void>;
};

function getCurrentMonthValue() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
}

export default function useDisconnectPanel({
  canAdmin,
  canSelectCtv,
  enabled,
  hasSession,
}: UseDisconnectPanelOptions): DisconnectPanelController {
  const [reportMonth, setReportMonth] = useState("");
  const [cancelMonth, setCancelMonth] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [importSourceType, setImportSourceType] = useState<DisconnectSourceType>(DISCONNECT_SOURCE_TV);
  const [accountFilter, setAccountFilter] = useState("");
  const [debouncedAccountFilter, setDebouncedAccountFilter] = useState("");
  const [selectedCtv, setSelectedCtv] = useState("");
  const [managerFilter, setManagerFilter] = useState("");
  const [availableReportMonths, setAvailableReportMonths] = useState<string[]>([]);
  const [availableCancelMonths, setAvailableCancelMonths] = useState<string[]>([]);
  const [rows, setRows] = useState<DisconnectRow[]>([]);
  const [totals, setTotals] = useState<DisconnectTotals>({ total: 0, upcoming: 0, overdue: 0 });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const requestRef = useRef(0);
  const lastRequestKeyRef = useRef("");
  const hasDataRef = useRef(false);
  const prevFilterKeyRef = useRef("");
  const pageSize = 40;

  useEffect(() => {
    const id = setTimeout(() => setDebouncedAccountFilter(normalizeCdtAccountSearch(accountFilter)), 320);
    return () => clearTimeout(id);
  }, [accountFilter]);

  const fetchReport = useCallback(
    async (options?: { force?: boolean; reportMonthOverride?: string; pageOverride?: number; sourceTypeOverride?: string }) => {
      if (!hasSession || !enabled) return;

      const effectiveReportMonth =
        options?.reportMonthOverride !== undefined ? options.reportMonthOverride : reportMonth;
      const effectivePage = options?.pageOverride ?? page;
      const effectiveSourceType = options?.sourceTypeOverride !== undefined ? options.sourceTypeOverride : sourceFilter;
      const normalizedReportMonth = normalizeDisconnectReportMonth(effectiveReportMonth);
      const normalizedCancelMonth = normalizeDisconnectReportMonth(cancelMonth);
      const normalizedSourceType = normalizeDisconnectSourceType(effectiveSourceType);
      const requestKey = [
        normalizedReportMonth || "",
        normalizedCancelMonth || "",
        normalizedSourceType || "ALL",
        debouncedAccountFilter || "",
        canSelectCtv ? selectedCtv : "",
        canAdmin ? managerFilter : "",
        effectivePage,
      ].join("|");

      if (!options?.force && hasDataRef.current && lastRequestKeyRef.current === requestKey) {
        return;
      }
      lastRequestKeyRef.current = requestKey;

      const reqId = ++requestRef.current;
      setErrorMessage(null);
      if (!hasDataRef.current) setLoading(true);
      else setRefreshing(true);

      try {
        const params = new URLSearchParams();
        if (normalizedReportMonth) params.set("reportMonth", normalizedReportMonth);
        if (normalizedCancelMonth) params.set("cancelMonth", normalizedCancelMonth);
        if (normalizedSourceType) params.set("sourceType", normalizedSourceType);
        if (debouncedAccountFilter) params.set("account", debouncedAccountFilter);
        if (canSelectCtv && selectedCtv) params.set("ctvUser", selectedCtv);
        if (canAdmin && managerFilter) params.set("managerCode", managerFilter);
        params.set("page", String(Math.max(1, effectivePage)));
        params.set("pageSize", String(pageSize));

        const res = await fetch(`/api/disconnect/report?${params.toString()}`);
        const data = await res.json();
        if (reqId !== requestRef.current) return;
        if (!res.ok) throw new Error(data?.error || TEXT.loadFailed);

        setErrorMessage(null);
        setRows(Array.isArray(data?.rows) ? data.rows : []);
        setTotals(data?.totals || { total: 0, upcoming: 0, overdue: 0 });
        setAvailableReportMonths(Array.isArray(data?.availableReportMonths) ? data.availableReportMonths : []);
        setAvailableCancelMonths(Array.isArray(data?.availableCancelMonths) ? data.availableCancelMonths : []);
        const nextReportMonth = String(data?.reportMonth || "").trim();
        if (nextReportMonth && nextReportMonth !== reportMonth) setReportMonth(nextReportMonth);
        const nextTotalPages = Math.max(1, Number(data?.pagination?.totalPages || 1));
        const currentPage = Math.max(1, Number(data?.pagination?.page || effectivePage || 1));
        setTotalPages(nextTotalPages);
        if (currentPage !== page) setPage(currentPage);
        hasDataRef.current = true;
      } catch (error: any) {
        if (reqId !== requestRef.current) return;
        const nextError = error?.message || TEXT.loadFailed;
        setErrorMessage(nextError);
        toast.error(nextError);
        if (!hasDataRef.current) {
          setRows([]);
          setTotals({ total: 0, upcoming: 0, overdue: 0 });
          setAvailableReportMonths([]);
          setAvailableCancelMonths([]);
          setTotalPages(1);
        }
      } finally {
        if (reqId === requestRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [canAdmin, canSelectCtv, cancelMonth, debouncedAccountFilter, enabled, hasSession, managerFilter, page, reportMonth, selectedCtv, sourceFilter],
  );

  const handleImport = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file || !canAdmin) return;

      const normalizedReportMonth = normalizeDisconnectReportMonth(reportMonth || getCurrentMonthValue());
      if (!normalizedReportMonth) {
        toast.error(TEXT.invalidReportMonth);
        event.target.value = "";
        return;
      }

      setImporting(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("reportMonth", normalizedReportMonth);
        formData.append("sourceType", importSourceType);
        const res = await fetch("/api/disconnect/import", { method: "POST", body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || TEXT.importFailed);

        setReportMonth(normalizedReportMonth);
        setSourceFilter(importSourceType);
        setPage(1);
        const sourceLabel = getDisconnectSourceLabel(importSourceType);
        const inserted = Number(data?.inserted || 0);
        const skippedUnknownCtv = Number(data?.skippedUnknownCtv || 0);
        const successMessage = skippedUnknownCtv > 0
          ? `${TEXT.importSuccess} ${sourceLabel} (${inserted} dòng, bỏ qua ${skippedUnknownCtv} mã CTV không tồn tại)`
          : `${TEXT.importSuccess} ${sourceLabel} (${inserted} dòng)`;
        toast.success(successMessage);
        await fetchReport({
          force: true,
          reportMonthOverride: normalizedReportMonth,
          pageOverride: 1,
          sourceTypeOverride: importSourceType,
        });
      } catch (error: any) {
        toast.error(error?.message || TEXT.importFailed);
      } finally {
        setImporting(false);
        event.target.value = "";
      }
    },
    [canAdmin, fetchReport, importSourceType, reportMonth],
  );

  const handleDownloadTemplate = useCallback(async () => {
    if (!canAdmin || downloadingTemplate) return;
    try {
      setDownloadingTemplate(true);
      const params = new URLSearchParams({ sourceType: importSourceType });
      const res = await fetch(`/api/disconnect/template?${params.toString()}`);
      if (!res.ok) {
        let message = TEXT.downloadTemplateFailed;
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
      anchor.download = importSourceType === "FTTH" ? "mau-roi-mang-ftth.xlsx" : "mau-roi-mang-truyen-hinh.xlsx";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
      toast.success(`${TEXT.downloadTemplateSuccess} ${getDisconnectSourceLabel(importSourceType)}`);
    } catch (error: any) {
      toast.error(error?.message || TEXT.downloadTemplateFailed);
    } finally {
      setDownloadingTemplate(false);
    }
  }, [canAdmin, downloadingTemplate, importSourceType]);

  const toggleMobileFilters = useCallback(() => {
    setShowMobileFilters((current) => !current);
  }, []);

  useEffect(() => {
    if (!hasSession || !enabled) return;
    const nextFilterKey = [
      reportMonth || "",
      cancelMonth || "",
      sourceFilter || "ALL",
      debouncedAccountFilter || "",
      canSelectCtv ? selectedCtv : "",
      canAdmin ? managerFilter : "",
    ].join("|");
    const filtersChanged = prevFilterKeyRef.current !== "" && prevFilterKeyRef.current !== nextFilterKey;
    prevFilterKeyRef.current = nextFilterKey;
    if (filtersChanged && page !== 1) return;
    void fetchReport();
  }, [canAdmin, canSelectCtv, cancelMonth, debouncedAccountFilter, enabled, fetchReport, hasSession, managerFilter, page, reportMonth, selectedCtv, sourceFilter]);

  useEffect(() => {
    setPage(1);
  }, [accountFilter, cancelMonth, canAdmin, canSelectCtv, managerFilter, reportMonth, selectedCtv, sourceFilter]);

  const reportMonthLabel = useMemo(() => {
    if (!reportMonth) return TEXT.reportMonthPlaceholder;
    return formatDisconnectReportMonthLabel(reportMonth);
  }, [reportMonth]);

  const activeMobileFilterCount = useMemo(() => {
    let count = 0;
    if (cancelMonth) count += 1;
    if (sourceFilter) count += 1;
    if (accountFilter.trim()) count += 1;
    if (selectedCtv) count += 1;
    if (managerFilter) count += 1;
    return count;
  }, [accountFilter, cancelMonth, managerFilter, selectedCtv, sourceFilter]);

  return {
    reportMonth,
    cancelMonth,
    sourceFilter,
    importSourceType,
    accountFilter,
    selectedCtv,
    managerFilter,
    availableReportMonths,
    availableCancelMonths,
    reportMonthLabel,
    activeMobileFilterCount,
    showMobileFilters,
    loading,
    refreshing,
    importing,
    downloadingTemplate,
    errorMessage,
    rows,
    totals,
    page,
    totalPages,
    setReportMonth,
    setCancelMonth,
    setSourceFilter,
    setImportSourceType,
    setAccountFilter,
    setSelectedCtv,
    setManagerFilter,
    setPage,
    toggleMobileFilters,
    fetchReport,
    handleImport,
    handleDownloadTemplate,
  };
}
