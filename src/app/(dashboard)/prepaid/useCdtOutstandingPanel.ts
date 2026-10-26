"use client";

import type { ChangeEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { normalizeCdtAccountSearch } from "@/lib/cdt-account-search";
import {
  formatOutstandingReportMonthLabel,
  OUTSTANDING_STATUS_PENDING,
  normalizeOutstandingReportMonth,
} from "@/lib/cdt-outstanding";

const TEXT = {
  loadFailed: "Kh\u00f4ng t\u1ea3i \u0111\u01b0\u1ee3c T\u1ed3n CDT",
  invalidReportMonth: "K\u1ef3 file kh\u00f4ng h\u1ee3p l\u1ec7",
  importFailed: "Import T\u1ed3n CDT th\u1ea5t b\u1ea1i",
  importSuccess: "Import T\u1ed3n CDT th\u00e0nh c\u00f4ng",
  downloadTemplateFailed: "T\u1ea3i file m\u1eabu T\u1ed3n CDT th\u1ea5t b\u1ea1i",
  downloadTemplateSuccess: "\u0110\u00e3 t\u1ea3i file m\u1eabu T\u1ed3n CDT",
  reportMonthPlaceholder: "Ch\u01b0a ch\u1ecdn k\u1ef3 file",
} as const;

type OutstandingRow = {
  id: number;
  reportMonth: string;
  account: string;
  customerName?: string | null;
  phone?: string | null;
  address?: string | null;
  ctvCode: string;
  serviceName?: string | null;
  expiryDateText?: string | null;
  expiryMonth: string;
  statusCheck: string;
  subscriberType: string;
};

type OutstandingTotals = {
  total: number;
  chuaThu: number;
  daThu: number;
  ftth: number;
  ths: number;
  camera: number;
  khac: number;
  chuaThuFtth: number;
  chuaThuThs: number;
  chuaThuCamera: number;
  chuaThuKhac: number;
  daThuFtth: number;
  daThuThs: number;
  daThuCamera: number;
  daThuKhac: number;
};

type UseCdtOutstandingPanelOptions = {
  canAdmin: boolean;
  canSelectCtv: boolean;
  enabled: boolean;
  hasSession: boolean;
};

export type CdtOutstandingPanelController = {
  reportMonth: string;
  expiryMonth: string;
  statusFilter: string;
  accountFilter: string;
  selectedCtv: string;
  managerFilter: string;
  availableReportMonths: string[];
  availableExpiryMonths: string[];
  reportMonthLabel: string;
  activeMobileFilterCount: number;
  showMobileFilters: boolean;
  loading: boolean;
  refreshing: boolean;
  importing: boolean;
  downloadingTemplate: boolean;
  errorMessage: string | null;
  rows: OutstandingRow[];
  totals: OutstandingTotals;
  page: number;
  totalPages: number;
  setReportMonth: (value: string) => void;
  setExpiryMonth: (value: string) => void;
  setStatusFilter: (value: string) => void;
  setAccountFilter: (value: string) => void;
  setSelectedCtv: (value: string) => void;
  setManagerFilter: (value: string) => void;
  setPage: (value: number | ((current: number) => number)) => void;
  toggleMobileFilters: () => void;
  fetchReport: (options?: {
    force?: boolean;
    reportMonthOverride?: string;
    pageOverride?: number;
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

export default function useCdtOutstandingPanel({
  canAdmin,
  canSelectCtv,
  enabled,
  hasSession,
}: UseCdtOutstandingPanelOptions): CdtOutstandingPanelController {
  const [reportMonth, setReportMonth] = useState("");
  const [expiryMonth, setExpiryMonth] = useState("");
  const [statusFilter, setStatusFilter] = useState(OUTSTANDING_STATUS_PENDING);
  const [accountFilter, setAccountFilter] = useState("");
  const [debouncedAccountFilter, setDebouncedAccountFilter] = useState("");
  const [selectedCtv, setSelectedCtv] = useState("");
  const [managerFilter, setManagerFilter] = useState("");
  const [availableReportMonths, setAvailableReportMonths] = useState<string[]>([]);
  const [availableExpiryMonths, setAvailableExpiryMonths] = useState<string[]>([]);
  const [rows, setRows] = useState<OutstandingRow[]>([]);
  const [totals, setTotals] = useState<OutstandingTotals>({
    total: 0,
    chuaThu: 0,
    daThu: 0,
    ftth: 0,
    ths: 0,
    camera: 0,
    khac: 0,
    chuaThuFtth: 0,
    chuaThuThs: 0,
    chuaThuCamera: 0,
    chuaThuKhac: 0,
    daThuFtth: 0,
    daThuThs: 0,
    daThuCamera: 0,
    daThuKhac: 0,
  });
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
    async (options?: { force?: boolean; reportMonthOverride?: string; pageOverride?: number }) => {
      if (!hasSession || !enabled) return;

      const effectiveReportMonth =
        options?.reportMonthOverride !== undefined ? options.reportMonthOverride : reportMonth;
      const effectivePage = options?.pageOverride ?? page;
      const normalizedReportMonth = normalizeOutstandingReportMonth(effectiveReportMonth);

      const requestKey = [
        normalizedReportMonth || "",
        expiryMonth || "",
        statusFilter || "",
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
        if (expiryMonth) params.set("expiryMonth", expiryMonth);
        if (statusFilter) params.set("status", statusFilter);
        if (debouncedAccountFilter) params.set("account", debouncedAccountFilter);
        if (canSelectCtv && selectedCtv) params.set("ctvUser", selectedCtv);
        if (canAdmin && managerFilter) params.set("managerCode", managerFilter);
        params.set("page", String(Math.max(1, effectivePage)));
        params.set("pageSize", String(pageSize));

        const res = await fetch(`/api/cdt/outstanding/report?${params.toString()}`);
        const data = await res.json();
        if (reqId !== requestRef.current) return;
        if (!res.ok) throw new Error(data?.error || TEXT.loadFailed);

        setErrorMessage(null);
        setRows(Array.isArray(data?.rows) ? data.rows : []);
        setTotals(
          data?.totals || {
            total: 0,
            chuaThu: 0,
            daThu: 0,
            ftth: 0,
            ths: 0,
            camera: 0,
            khac: 0,
            chuaThuFtth: 0,
            chuaThuThs: 0,
            chuaThuCamera: 0,
            chuaThuKhac: 0,
            daThuFtth: 0,
            daThuThs: 0,
            daThuCamera: 0,
            daThuKhac: 0,
          },
        );
        setAvailableReportMonths(Array.isArray(data?.availableReportMonths) ? data.availableReportMonths : []);
        setAvailableExpiryMonths(Array.isArray(data?.availableExpiryMonths) ? data.availableExpiryMonths : []);
        const nextReportMonth = String(data?.reportMonth || "").trim();
        if (nextReportMonth && nextReportMonth !== reportMonth) {
          setReportMonth(nextReportMonth);
        }
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
          setTotals({
            total: 0,
            chuaThu: 0,
            daThu: 0,
            ftth: 0,
            ths: 0,
            camera: 0,
            khac: 0,
            chuaThuFtth: 0,
            chuaThuThs: 0,
            chuaThuCamera: 0,
            chuaThuKhac: 0,
            daThuFtth: 0,
            daThuThs: 0,
            daThuCamera: 0,
            daThuKhac: 0,
          });
          setAvailableReportMonths([]);
          setAvailableExpiryMonths([]);
          setTotalPages(1);
        }
      } finally {
        if (reqId === requestRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [canAdmin, canSelectCtv, debouncedAccountFilter, enabled, expiryMonth, hasSession, managerFilter, page, reportMonth, selectedCtv, statusFilter],
  );

  const handleImport = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file || !canAdmin) return;

      const normalizedReportMonth = normalizeOutstandingReportMonth(reportMonth || getCurrentMonthValue());
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
        const res = await fetch("/api/cdt/outstanding/import", { method: "POST", body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || TEXT.importFailed);

        setReportMonth(normalizedReportMonth);
        setPage(1);
        toast.success(`${TEXT.importSuccess} (${data?.inserted || 0} d\u00f2ng)`);
        await fetchReport({ force: true, reportMonthOverride: normalizedReportMonth, pageOverride: 1 });
      } catch (error: any) {
        toast.error(error?.message || TEXT.importFailed);
      } finally {
        setImporting(false);
        event.target.value = "";
      }
    },
    [canAdmin, fetchReport, reportMonth],
  );

  const handleDownloadTemplate = useCallback(async () => {
    if (!canAdmin || downloadingTemplate) return;
    try {
      setDownloadingTemplate(true);
      const res = await fetch("/api/cdt/outstanding/template");
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
      anchor.download = "mau_ton_cdt.xlsx";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
      toast.success(TEXT.downloadTemplateSuccess);
    } catch (error: any) {
      toast.error(error?.message || TEXT.downloadTemplateFailed);
    } finally {
      setDownloadingTemplate(false);
    }
  }, [canAdmin, downloadingTemplate]);

  const toggleMobileFilters = useCallback(() => {
    setShowMobileFilters((current) => !current);
  }, []);

  useEffect(() => {
    if (!hasSession || !enabled) return;
    const nextFilterKey = [
      reportMonth || "",
      expiryMonth || "",
      statusFilter || "",
      debouncedAccountFilter || "",
      canSelectCtv ? selectedCtv : "",
      canAdmin ? managerFilter : "",
    ].join("|");
    const filtersChanged = prevFilterKeyRef.current !== "" && prevFilterKeyRef.current !== nextFilterKey;
    prevFilterKeyRef.current = nextFilterKey;
    if (filtersChanged && page !== 1) return;
    void fetchReport();
  }, [canAdmin, canSelectCtv, debouncedAccountFilter, enabled, expiryMonth, fetchReport, hasSession, managerFilter, page, reportMonth, selectedCtv, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [accountFilter, canAdmin, canSelectCtv, expiryMonth, managerFilter, reportMonth, selectedCtv, statusFilter]);

  const reportMonthLabel = useMemo(() => {
    if (!reportMonth) return TEXT.reportMonthPlaceholder;
    return formatOutstandingReportMonthLabel(reportMonth);
  }, [reportMonth]);

  const activeMobileFilterCount = useMemo(() => {
    let count = 0;
    if (expiryMonth) count += 1;
    if (statusFilter && statusFilter !== OUTSTANDING_STATUS_PENDING) count += 1;
    if (accountFilter.trim()) count += 1;
    if (selectedCtv) count += 1;
    if (managerFilter) count += 1;
    return count;
  }, [accountFilter, expiryMonth, managerFilter, selectedCtv, statusFilter]);

  return {
    reportMonth,
    expiryMonth,
    statusFilter,
    accountFilter,
    selectedCtv,
    managerFilter,
    availableReportMonths,
    availableExpiryMonths,
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
    setExpiryMonth,
    setStatusFilter,
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
