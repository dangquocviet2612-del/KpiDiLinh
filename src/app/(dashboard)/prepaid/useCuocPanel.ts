"use client";

import type { ChangeEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";

type CuocRow = {
  ctvUser: string;
  targetAmount: number;
  completionPercent: number;
  missingAmount: number;
};

type UseCuocPanelOptions = {
  canAdmin: boolean;
  canViewCuoc: boolean;
  enabled: boolean;
  hasSession: boolean;
};

export type CuocPanelController = {
  reportDate: string;
  dateLabel: string;
  targetRate: number;
  rateDirty: boolean;
  savingRate: boolean;
  loading: boolean;
  refreshing: boolean;
  importing: boolean;
  showMobileFilters: boolean;
  errorMessage: string | null;
  rows: CuocRow[];
  summaryRow: CuocRow | null;
  pagedRows: CuocRow[];
  page: number;
  totalPages: number;
  pageSize: number;
  setReportDate: (value: string) => void;
  setPage: (value: number | ((current: number) => number)) => void;
  onTargetRateChange: (value: number) => void;
  toggleMobileFilters: () => void;
  fetchReport: (options?: { reportDateOverride?: string; force?: boolean }) => Promise<void>;
  saveRate: () => Promise<void>;
  handleImport: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
};

const CUOC_LOAD_ERROR = "Kh\u00F4ng t\u1EA3i \u0111\u01B0\u1EE3c d\u1EEF li\u1EC7u c\u01B0\u1EDBc";
const CUOC_RATE_SAVE_ERROR = "L\u01B0u t\u1EF7 l\u1EC7 th\u1EA5t b\u1EA1i";
const CUOC_IMPORT_ERROR = "Import c\u01B0\u1EDBc th\u1EA5t b\u1EA1i";
const CHOOSE_DATE_LABEL = "Ch\u1ECDn ng\u00E0y";

function normalizeCuocRow(input: any): CuocRow | null {
  if (!input || typeof input.ctvUser !== "string") return null;
  return {
    ctvUser: String(input.ctvUser),
    targetAmount: Number(input.targetAmount || 0),
    completionPercent: Number(input.completionPercent || 0),
    missingAmount: Number(input.missingAmount || 0),
  };
}

export default function useCuocPanel({
  canAdmin,
  canViewCuoc,
  enabled,
  hasSession,
}: UseCuocPanelOptions): CuocPanelController {
  const [reportDate, setReportDate] = useState("");
  const [dateInitialized, setDateInitialized] = useState(false);
  const [debouncedReportDate, setDebouncedReportDate] = useState("");
  const [rows, setRows] = useState<CuocRow[]>([]);
  const [summaryRow, setSummaryRow] = useState<CuocRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 40;
  const [importing, setImporting] = useState(false);
  const [targetRate, setTargetRate] = useState(97.3);
  const [savedTargetRate, setSavedTargetRate] = useState(97.3);
  const [rateDirty, setRateDirty] = useState(false);
  const [savingRate, setSavingRate] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const reqRef = useRef(0);
  const lastKeyRef = useRef("");

  useEffect(() => {
    const id = setTimeout(() => setDebouncedReportDate(reportDate), 320);
    return () => clearTimeout(id);
  }, [reportDate]);

  const fetchReport = useCallback(
    async (options?: { reportDateOverride?: string; force?: boolean }) => {
      if (!hasSession || !canViewCuoc) return;
      const effectiveDate =
        options?.reportDateOverride !== undefined ? options.reportDateOverride : debouncedReportDate;
      const requestKey = effectiveDate || "__latest__";
      if (!options?.force && rows.length > 0 && lastKeyRef.current === requestKey) {
        return;
      }
      const hadRows = rows.length > 0;
      lastKeyRef.current = requestKey;
      const reqId = ++reqRef.current;
      setErrorMessage(null);
      if (!hadRows) setLoading(true);
      else setRefreshing(true);
      try {
        const params = new URLSearchParams();
        if (effectiveDate) params.set("reportDate", effectiveDate);
        const res = await fetch(`/api/cuoc/report?${params.toString()}`);
        const data = await res.json();
        if (reqId !== reqRef.current) return;
        if (!res.ok) throw new Error(data?.error || CUOC_LOAD_ERROR);
        setErrorMessage(null);
        setRows(Array.isArray(data.rows) ? data.rows.map(normalizeCuocRow).filter(Boolean) as CuocRow[] : []);
        setSummaryRow(normalizeCuocRow(data.summaryRow));
        if (Number.isFinite(Number(data.targetRatePercent))) {
          const persisted = Number(data.targetRatePercent);
          setSavedTargetRate(persisted);
          if (!rateDirty) setTargetRate(persisted);
        }
        if (data.reportDate && (!dateInitialized || options?.reportDateOverride !== undefined)) {
          setReportDate(String(data.reportDate));
          setDateInitialized(true);
        }
      } catch (error: any) {
        if (reqId !== reqRef.current) return;
        const nextError = error?.message || CUOC_LOAD_ERROR;
        setErrorMessage(nextError);
        toast.error(nextError);
        if (!hadRows) {
          setRows([]);
          setSummaryRow(null);
        }
      } finally {
        if (reqId === reqRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [canViewCuoc, dateInitialized, debouncedReportDate, hasSession, rateDirty, rows.length]
  );

  const saveRate = useCallback(async () => {
    if (!canAdmin) return;
    setSavingRate(true);
    try {
      const res = await fetch("/api/cuoc/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetRatePercent: targetRate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || CUOC_RATE_SAVE_ERROR);
      const saved = Number(data?.targetRatePercent ?? targetRate);
      setSavedTargetRate(saved);
      setTargetRate(saved);
      setRateDirty(false);
      toast.success(`\u0110\u00E3 l\u01B0u t\u1EF7 l\u1EC7 ${saved.toFixed(2)}%`);
      setReportDate("");
      setDateInitialized(false);
      await fetchReport({ force: true });
    } catch (error: any) {
      toast.error(error?.message || CUOC_RATE_SAVE_ERROR);
    } finally {
      setSavingRate(false);
    }
  }, [canAdmin, fetchReport, targetRate]);

  const handleImport = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      setImporting(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/cuoc/import", { method: "POST", body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || CUOC_IMPORT_ERROR);
        toast.success(`Import c\u01B0\u1EDBc th\u00E0nh c\u00F4ng (${data.inserted} d\u00F2ng)`);
        setReportDate("");
        setDateInitialized(false);
        await fetchReport({ reportDateOverride: "", force: true });
      } catch (error: any) {
        toast.error(error?.message || CUOC_IMPORT_ERROR);
      } finally {
        setImporting(false);
        event.target.value = "";
      }
    },
    [fetchReport]
  );

  const onTargetRateChange = useCallback(
    (value: number) => {
      setTargetRate(value);
      setRateDirty(Math.abs(value - savedTargetRate) > 0.000001);
    },
    [savedTargetRate]
  );

  const toggleMobileFilters = useCallback(() => {
    setShowMobileFilters((current) => !current);
  }, []);

  useEffect(() => {
    if (!hasSession || !enabled) return;
    void fetchReport();
  }, [enabled, fetchReport, hasSession]);

  useEffect(() => {
    setPage(1);
  }, [debouncedReportDate]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const pagedRows = useMemo(() => rows.slice((page - 1) * pageSize, page * pageSize), [page, rows]);
  const dateLabel = useMemo(() => {
    if (!reportDate) return CHOOSE_DATE_LABEL;
    const datePart = String(reportDate).slice(0, 10);
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
    if (!match) return CHOOSE_DATE_LABEL;
    return `${match[3]}/${match[2]}/${match[1]}`;
  }, [reportDate]);

  return {
    reportDate,
    dateLabel,
    targetRate,
    rateDirty,
    savingRate,
    loading,
    refreshing,
    importing,
    showMobileFilters,
    errorMessage,
    rows,
    summaryRow,
    pagedRows,
    page,
    totalPages,
    pageSize,
    setReportDate,
    setPage,
    onTargetRateChange,
    toggleMobileFilters,
    fetchReport,
    saveRate,
    handleImport,
  };
}
