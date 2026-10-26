"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import toast from "react-hot-toast";
import type { CuocCdRow, CuocCdSummaryRow } from "@/lib/cuoc-cd";

type UseCuocCdPanelProps = {
  canAdmin: boolean;
  canViewCuoc: boolean;
  enabled: boolean;
  hasSession: boolean;
};

export default function useCuocCdPanel({
  canAdmin,
  canViewCuoc,
  enabled,
  hasSession,
}: UseCuocCdPanelProps) {
  const [reportDate, setReportDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [rows, setRows] = useState<CuocCdRow[]>([]);
  const [summaryRow, setSummaryRow] = useState<CuocCdSummaryRow | null>(null);
  const [page, setPage] = useState(1);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const pageSize = 40;

  // Target rate state (default 99.5%)
  const [targetRate, setTargetRate] = useState(99.5);
  const [savedTargetRate, setSavedTargetRate] = useState(99.5);
  const [rateDirty, setRateDirty] = useState(false);
  const [savingRate, setSavingRate] = useState(false);

  const fetchReport = useCallback(
    async (options?: { force?: boolean; reportDateOverride?: string }) => {
      if (!hasSession || !canViewCuoc || !enabled) return;

      if (!options?.force && rows.length > 0) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setErrorMessage(null);
      try {
        const targetDate =
          options?.reportDateOverride !== undefined ? options.reportDateOverride : reportDate;
        const params = new URLSearchParams();
        if (targetDate) params.set("reportDate", targetDate);

        const res = await fetch(`/api/cuoc-cd/report?${params.toString()}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Không tải được báo cáo Cước CD");
        }

        setRows(data.rows || []);
        setSummaryRow(data.summaryRow || null);
        if (data.reportDate) {
          setReportDate(data.reportDate);
        }
        if (Number.isFinite(Number(data.targetRatePercent))) {
          const persisted = Number(data.targetRatePercent);
          setSavedTargetRate(persisted);
          if (!rateDirty) setTargetRate(persisted);
        }
      } catch (err: any) {
        const msg = err.message || "Lỗi tải báo cáo Cước CD";
        setErrorMessage(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [canViewCuoc, enabled, hasSession, rateDirty, reportDate, rows.length]
  );

  useEffect(() => {
    if (enabled && hasSession && canViewCuoc) {
      void fetchReport();
    }
  }, [canViewCuoc, enabled, fetchReport, hasSession]);

  const onTargetRateChange = useCallback(
    (value: number) => {
      setTargetRate(value);
      setRateDirty(Math.abs(value - savedTargetRate) > 0.000001);
    },
    [savedTargetRate]
  );

  const saveRate = useCallback(async () => {
    if (!canAdmin) return;
    setSavingRate(true);
    try {
      const res = await fetch("/api/cuoc-cd/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetRatePercent: targetRate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Lưu tỉ lệ thất bại");
      const saved = Number(data?.targetRatePercent ?? targetRate);
      setSavedTargetRate(saved);
      setTargetRate(saved);
      setRateDirty(false);
      toast.success(`Đã lưu tỉ lệ ${saved}%`);
      await fetchReport({ force: true });
    } catch (error: any) {
      toast.error(error?.message || "Lưu tỉ lệ thất bại");
    } finally {
      setSavingRate(false);
    }
  }, [canAdmin, fetchReport, targetRate]);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/cuoc-cd/import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Import Cước CD thất bại");
      }

      toast.success(data.message || `Import Cước CD thành công (${data.inserted} dòng)`);
      const importedDate = data.reportDate ? String(data.reportDate) : undefined;
      if (importedDate) {
        setReportDate(importedDate);
      }
      await fetchReport({ force: true, reportDateOverride: importedDate });
    } catch (err: any) {
      toast.error(err.message || "Import Cước CD thất bại");
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };


  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(rows.length / pageSize)),
    [rows.length, pageSize]
  );

  const pagedRows = useMemo(
    () => rows.slice((page - 1) * pageSize, page * pageSize),
    [page, rows, pageSize]
  );

  const dateLabel = useMemo(() => {
    if (!reportDate) return "";
    const parts = reportDate.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return reportDate;
  }, [reportDate]);

  const toggleMobileFilters = () => setShowMobileFilters((prev) => !prev);

  return {
    reportDate,
    setReportDate,
    dateLabel,
    targetRate,
    rateDirty,
    savingRate,
    loading,
    refreshing,
    importing,
    errorMessage,
    rows,
    summaryRow,
    pagedRows,
    page,
    setPage,
    totalPages,
    pageSize,
    showMobileFilters,
    onTargetRateChange,
    saveRate,
    toggleMobileFilters,
    fetchReport,
    handleImport,
  };
}
