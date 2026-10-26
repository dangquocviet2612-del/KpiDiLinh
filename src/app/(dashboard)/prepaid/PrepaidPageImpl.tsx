"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import {
  computeCuocN1N3CompletionPercent,
  computeKpiCompletionPercent,
  computeKpiDayCompletionPercent,
  DEFAULT_KPI_MAX_PERCENT,
  isCuocN1N3MetricKey,
} from "@/lib/kpi-scoring";
import { sortKpiRowsByCompletion } from "@/lib/kpi-row-sorting";
import {
  filterIncompleteKpiSummaryRows,
  sortKpiSummaryRowsByCompletion,
} from "@/lib/kpi-summary";
import CdtPanelClean from "./CdtPanelClean";
import KpiCalculatorPanel from "./KpiCalculatorPanel";
import CdtOutstandingPanelClean from "./CdtOutstandingPanelClean";
import CdtSummaryPanelClean from "./CdtSummaryPanelClean";
import CuocPanelClean from "./CuocPanelClean";
import CuocCdPanelClean from "./CuocCdPanelClean";
import DisconnectPanelClean from "./DisconnectPanelClean";
import OfficialDocsPanel from "./OfficialDocsPanel";
import ManagerSummaryKpiPanelClean from "./ManagerSummaryKpiPanelClean";
import PersonalKpiPanelClean from "./PersonalKpiPanelClean";
import SummaryKpiPanelClean from "./SummaryKpiPanelClean";
import useCdtPanel from "./useCdtPanel";
import useCdtOutstandingPanel from "./useCdtOutstandingPanel";
import useDisconnectPanel from "./useDisconnectPanel";
import useKpiCalculator from "./useKpiCalculator";
import useCuocPanel from "./useCuocPanel";
import useCuocCdPanel from "./useCuocCdPanel";
import useOfficialDocsPanel from "./useOfficialDocsPanel";
import styles from "./kpi.module.css";

type KpiRow = {
  kpiCode: string;
  displayName: string;
  khThang: number | null;
  thNgay: number | null;
  thLuyKe: number | null;
  completionPercent: number;
  baseScore: number;
  maxPercent: number;
  maxScore: number;
  achievedScore: number;
};
type ManagerSummaryRow = {
  managerUser: string;
  managerName?: string | null;
  jobTitle?: string | null;
  kh: number;
  th: number;
  percent: number;
  thieu: number;
};
type SummaryRow = {
  ctvUser: string;
  kh: number;
  th: number;
  percent: number;
  thieu: number;
};

const formatIsoToVnDate = (value?: string | null): string => {
  if (!value) return "";
  const datePart = String(value).slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
  if (!m) return "";
  return `${m[3]}/${m[2]}/${m[1]}`;
};

const formatMetricNumber = (value: number): string => {
  const numeric = Number(value || 0);
  if (Number.isInteger(numeric)) {
    return numeric.toLocaleString("vi-VN");
  }
  return numeric.toLocaleString("vi-VN", { maximumFractionDigits: 2 });
};

const formatMetricPercent = (value: number): string => {
  const numeric = Number(value || 0);
  return `${numeric.toLocaleString("vi-VN", { maximumFractionDigits: 2 })}%`;
};

const getMonthProgressPercent = (value?: string | null): number => {
  const source = String(value || "").trim();
  if (!source) return 0;
  const date = new Date(source);
  if (Number.isNaN(date.getTime())) return 0;
  const day = date.getDate();
  const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  if (!daysInMonth) return 0;
  return Number(((day / daysInMonth) * 100).toFixed(2));
};

const getPercentClass = (percent: number) => {
  if (percent >= 100) return styles.good;
  if (percent >= 70) return styles.warn;
  return styles.bad;
};

const getPercentBgClass = (percent: number) => {
  if (percent >= 100) return styles.goodBg;
  if (percent >= 70) return styles.warnBg;
  return styles.badBg;
};

const getThieuClass = (thieu: number) => {
  if (thieu <= 0) return styles.good;
  if (thieu <= 2) return styles.warn;
  return styles.bad;
};

const getThieuBgClass = (thieu: number) => {
  if (thieu <= 0) return styles.goodBg;
  if (thieu <= 2) return styles.warnBg;
  return styles.badBg;
};

const getStatusLabel = (percent: number) => {
  if (percent >= 100) return "Vượt chuẩn";
  if (percent >= 70) return "Sát ngưỡng";
  return "Chưa đạt";
};

const getCdtTypeToneClass = (subscriberType?: string | null) => {
  const value = String(subscriberType || "").toUpperCase();
  if (value === "FTTH") return styles.cdtToneFtth;
  if (value === "THS") return styles.cdtToneThs;
  if (value === "CAMERA") return styles.cdtToneCamera;
  return styles.cdtToneDefault;
};

const surfaceActionBtnClass = "ui-action-btn ui-action-btn--compact";
const surfacePrimaryBtnClass = "ui-action-btn ui-action-btn--compact ui-action-btn--primary";
const surfacePaginationBtnClass = "ui-action-btn ui-action-btn--compact ui-action-btn--pill";
const surfaceBadgeClass = "ui-badge";
const surfacePrimaryBadgeClass = "ui-badge ui-badge--primary";
const surfaceChipClass = "ui-chip";

export default function KpiPage() {
  const { data: session } = useSession();
  const role = session?.user?.role || "";
  const canAdmin = role === "ADMIN";
  const canSelectCtv = role === "ADMIN" || role === "MANAGER";
  const canViewSummary = canSelectCtv;
  const canViewManagerKpi = role === "ADMIN" || role === "MANAGER";
  const canViewCuoc = role === "ADMIN" || role === "MANAGER" || role === "CTV";
  const canViewKpiCalculator = role === "ADMIN" || role === "MANAGER" || role === "CTV";

  const router = useRouter();
  const searchParams = useSearchParams();
  const isSummaryView = searchParams.get("view") === "summary";
  const isManagerSummaryView = searchParams.get("view") === "summary-manager";
  const isCuocView = searchParams.get("view") === "cuoc";
  const isCuocCdView = searchParams.get("view") === "cuoc-cd";
  const isCdtView = searchParams.get("view") === "cdt";
  const isCdtOutstandingView = searchParams.get("view") === "cdt-outstanding";
  const isDisconnectView = searchParams.get("view") === "disconnect";
  const isCdtReportView = searchParams.get("view") === "cdt-report";
  const isOfficialView = searchParams.get("view") === "official-docs";
  const isKpiCalculatorView = searchParams.get("view") === "kpi-calculator";
  const shouldRedirectManagerSummary = isManagerSummaryView && !!session?.user && !canViewManagerKpi;
  const shouldRedirectKpiCalculator = isKpiCalculatorView && !!session?.user && !canViewKpiCalculator;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [ctvOptions, setCtvOptions] = useState<any[]>([]);
  const [selectedCtv, setSelectedCtv] = useState("");
  const [reportDate, setReportDate] = useState("");
  const [dateInitialized, setDateInitialized] = useState(false);
  const [reportRows, setReportRows] = useState<KpiRow[]>([]);
  const [totals, setTotals] = useState({ totalBaseScore: 0, totalAchievedScore: 0 });
  const [personalErrorMessage, setPersonalErrorMessage] = useState<string | null>(null);

  const [indicators, setIndicators] = useState<string[]>([]);
  const [selectedIndicator, setSelectedIndicator] = useState("");
  const [managerIndicators, setManagerIndicators] = useState<string[]>([]);
  const [selectedManagerIndicator, setSelectedManagerIndicator] = useState("");
  const [summaryRows, setSummaryRows] = useState<SummaryRow[]>([]);
  const [summaryManagerRows, setSummaryManagerRows] = useState<ManagerSummaryRow[]>([]);
  const [managerSummaryAllRows, setManagerSummaryAllRows] = useState<any[]>([]);
  const [summaryErrorMessage, setSummaryErrorMessage] = useState<string | null>(null);
  const [managerSummaryErrorMessage, setManagerSummaryErrorMessage] = useState<string | null>(null);
  const [summaryMeta, setSummaryMeta] = useState({ isNegativeGroup: false, maxPercent: DEFAULT_KPI_MAX_PERCENT });
  const [summaryManagerMeta, setSummaryManagerMeta] = useState({ isNegativeGroup: false, maxPercent: DEFAULT_KPI_MAX_PERCENT });
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryRefreshing, setSummaryRefreshing] = useState(false);
  const [managerSummaryLoading, setManagerSummaryLoading] = useState(false);
  const [managerSummaryRefreshing, setManagerSummaryRefreshing] = useState(false);
  const [importingManagerKpi, setImportingManagerKpi] = useState(false);
  const [summaryPage, setSummaryPage] = useState(1);
  const [summaryOnlyIncomplete, setSummaryOnlyIncomplete] = useState(false);
  const [managerSummaryPage, setManagerSummaryPage] = useState(1);
  const summaryPageSize = 40;
  const [debouncedDate, setDebouncedDate] = useState("");
  const [debouncedCtv, setDebouncedCtv] = useState("");
  const [debouncedIndicator, setDebouncedIndicator] = useState("");
  const [debouncedManagerIndicator, setDebouncedManagerIndicator] = useState("");
  const [managerFilter, setManagerFilter] = useState("");
  const [debouncedManagerFilter, setDebouncedManagerFilter] = useState("");
  const personalReqRef = useRef(0);
  const summaryReqRef = useRef(0);
  const managerSummaryReqRef = useRef(0);
  const lastPersonalKeyRef = useRef("");
  const lastSummaryKeyRef = useRef("");
  const lastManagerSummaryKeyRef = useRef("");
  const hasPersonalDataRef = useRef(false);
  const hasSummaryDataRef = useRef(false);
  const hasManagerSummaryDataRef = useRef(false);
  useEffect(() => {
    const id = setTimeout(() => setDebouncedDate(reportDate), 320);
    return () => clearTimeout(id);
  }, [reportDate]);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedCtv(selectedCtv), 280);
    return () => clearTimeout(id);
  }, [selectedCtv]);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedIndicator(selectedIndicator), 250);
    return () => clearTimeout(id);
  }, [selectedIndicator]);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedManagerIndicator(selectedManagerIndicator), 250);
    return () => clearTimeout(id);
  }, [selectedManagerIndicator]);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedManagerFilter(managerFilter), 250);
    return () => clearTimeout(id);
  }, [managerFilter]);

  useEffect(() => {
    if (!shouldRedirectManagerSummary) return;
    router.replace("/prepaid");
  }, [router, shouldRedirectManagerSummary]);

  const fetchPersonal = useCallback(async (options?: { force?: boolean }) => {
    if (!session?.user) return;
    const requestKey = [debouncedCtv || "", debouncedDate || ""].join("|");
    if (!options?.force && hasPersonalDataRef.current && lastPersonalKeyRef.current === requestKey) {
      return;
    }
    const hadPersonalData = hasPersonalDataRef.current;
    lastPersonalKeyRef.current = requestKey;
    const reqId = ++personalReqRef.current;
    setPersonalErrorMessage(null);
    if (!hadPersonalData) setLoading(true);
    else setRefreshing(true);
    try {
      const params = new URLSearchParams();
      if (debouncedCtv && canSelectCtv) params.set("ctvUser", debouncedCtv);
      if (debouncedDate) params.set("reportDate", debouncedDate);
      const res = await fetch(`/api/kpi/report?${params.toString()}`);
      const data = await res.json();
      if (reqId !== personalReqRef.current) return;
      if (!res.ok) throw new Error(data?.error || "Không tải được dữ liệu KPI");
      setPersonalErrorMessage(null);
      setReportRows(data.rows || []);
      hasPersonalDataRef.current = true;
      setTotals({
        totalBaseScore: Number(data.totalBaseScore || 0),
        totalAchievedScore: Number(data.totalAchievedScore || 0),
      });
      if (data.reportDate && !dateInitialized) {
        setReportDate(data.reportDate);
        setDateInitialized(true);
      }
    } catch (error: any) {
      if (reqId !== personalReqRef.current) return;
      const nextError = error.message || "Không tải được dữ liệu KPI";
      setPersonalErrorMessage(nextError);
      toast.error(nextError);
      if (!hadPersonalData) {
        setReportRows([]);
        setTotals({ totalBaseScore: 0, totalAchievedScore: 0 });
      }
    } finally {
      if (reqId === personalReqRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [canSelectCtv, dateInitialized, debouncedCtv, debouncedDate, session?.user]);

  const fetchIndicatorList = useCallback(async (options?: { force?: boolean }) => {
    if (!session?.user || !canViewSummary) return;
    const requestKey = [debouncedDate || "", canAdmin ? debouncedManagerFilter : "", debouncedIndicator || "__auto__"].join("|");
    if (!options?.force && hasSummaryDataRef.current && lastSummaryKeyRef.current === requestKey) {
      return;
    }
    const hadSummaryData = hasSummaryDataRef.current;
    const reqId = ++summaryReqRef.current;
    setSummaryErrorMessage(null);
    if (!hadSummaryData) setSummaryLoading(true);
    else setSummaryRefreshing(true);
    try {
      const params = new URLSearchParams();
      if (debouncedDate) params.set("reportDate", debouncedDate);
      if (canAdmin && debouncedManagerFilter) params.set("managerCode", debouncedManagerFilter);
      if (debouncedIndicator) params.set("group", debouncedIndicator);
      const res = await fetch(`/api/kpi/summary?${params.toString()}`);
      const data = await res.json();
      if (reqId !== summaryReqRef.current) return;
      if (!res.ok) throw new Error(data?.error || "Không tải được tổng hợp KPI");
      setSummaryErrorMessage(null);
      const nextIndicators = Array.isArray(data.indicators) ? data.indicators : [];
      const nextSelected =
        String(data?.selectedGroup || "").trim() ||
        (debouncedIndicator && nextIndicators.includes(debouncedIndicator) ? debouncedIndicator : nextIndicators[0] || "");
      setIndicators(nextIndicators);
      setSelectedIndicator((current) => (current === nextSelected ? current : nextSelected));
      setSummaryRows(data.rows || []);
      setSummaryMeta({
        isNegativeGroup: Boolean(data?.isNegativeGroup),
        maxPercent: Number(data?.maxPercent ?? DEFAULT_KPI_MAX_PERCENT),
      });
      hasSummaryDataRef.current = true;
      lastSummaryKeyRef.current = [debouncedDate || "", canAdmin ? debouncedManagerFilter : "", nextSelected || "__auto__"].join("|");
      if (data.reportDate && !dateInitialized) {
        setReportDate(data.reportDate);
        setDateInitialized(true);
      }
    } catch (error: any) {
      if (reqId !== summaryReqRef.current) return;
      const nextError = error.message || "Không tải được tổng hợp KPI";
      setSummaryErrorMessage(nextError);
      toast.error(nextError);
      if (!hadSummaryData) {
        setIndicators([]);
        setSummaryRows([]);
        setSummaryMeta({ isNegativeGroup: false, maxPercent: DEFAULT_KPI_MAX_PERCENT });
      }
    } finally {
      if (reqId === summaryReqRef.current) {
        setSummaryLoading(false);
        setSummaryRefreshing(false);
      }
    }
  }, [canAdmin, canViewSummary, dateInitialized, debouncedDate, debouncedIndicator, debouncedManagerFilter, session?.user]);

  const fetchManagerIndicatorList = useCallback(async (options?: { force?: boolean }) => {
    if (!session?.user || !canViewSummary) return;
    const requestKey = [
      debouncedDate || "",
      canAdmin ? debouncedManagerFilter : "",
      debouncedManagerIndicator || "__auto__"
    ].join("|");
    if (!options?.force && hasManagerSummaryDataRef.current && lastManagerSummaryKeyRef.current === requestKey) {
      return;
    }
    const hadManagerSummaryData = hasManagerSummaryDataRef.current;
    const reqId = ++managerSummaryReqRef.current;
    setManagerSummaryErrorMessage(null);
    if (!hadManagerSummaryData) setManagerSummaryLoading(true);
    else setManagerSummaryRefreshing(true);
    try {
      const params = new URLSearchParams();
      if (debouncedDate) params.set("reportDate", debouncedDate);
      if (canAdmin && debouncedManagerFilter) params.set("managerCode", debouncedManagerFilter);
      if (debouncedManagerIndicator) params.set("group", debouncedManagerIndicator);
      const res = await fetch(`/api/kpi/manager-summary?${params.toString()}`);
      const data = await res.json();
      if (reqId !== managerSummaryReqRef.current) return;
      if (!res.ok) throw new Error(data?.error || "Không tải được KPI quản lý");
      setManagerSummaryErrorMessage(null);
      
      const rawIndicators = Array.isArray(data.indicators) ? data.indicators : [];
      const nextIndicators = rawIndicators.filter((ind: string) => ind !== "__all__");
      
      let nextSelected = "";
      if (debouncedManagerIndicator === "__all__") {
        nextSelected = "__all__";
      } else {
        nextSelected =
          String(data?.selectedGroup || "").trim() ||
          (debouncedManagerIndicator && nextIndicators.includes(debouncedManagerIndicator) ? debouncedManagerIndicator : nextIndicators[0] || "");
      }
      
      setManagerIndicators(nextIndicators);
      setSelectedManagerIndicator((current) => (current === nextSelected ? current : nextSelected));
      setSummaryManagerRows(data.rows || []);
      setManagerSummaryAllRows(data.allRows || []);
      setSummaryManagerMeta({
        isNegativeGroup: Boolean(data?.isNegativeGroup),
        maxPercent: Number(data?.maxPercent ?? DEFAULT_KPI_MAX_PERCENT),
      });
      hasManagerSummaryDataRef.current = true;
      lastManagerSummaryKeyRef.current = requestKey;
      if (data.reportDate && !dateInitialized) {
        setReportDate(data.reportDate);
        setDateInitialized(true);
      }
    } catch (error: any) {
      if (reqId !== managerSummaryReqRef.current) return;
      const nextError = error.message || "Không tải được KPI quản lý";
      setManagerSummaryErrorMessage(nextError);
      toast.error(nextError);
      if (!hadManagerSummaryData) {
        setManagerIndicators([]);
        setSummaryManagerRows([]);
        setManagerSummaryAllRows([]);
        setSummaryManagerMeta({ isNegativeGroup: false, maxPercent: DEFAULT_KPI_MAX_PERCENT });
      }
    } finally {
      if (reqId === managerSummaryReqRef.current) {
        setManagerSummaryLoading(false);
        setManagerSummaryRefreshing(false);
      }
    }
  }, [canAdmin, canViewSummary, dateInitialized, debouncedDate, debouncedManagerFilter, debouncedManagerIndicator, session?.user]);


  const officialDocsPanel = useOfficialDocsPanel({
    canAdmin,
    enabled: isOfficialView,
    hasSession: !!session?.user,
  });

  const cdtPanel = useCdtPanel({
    canAdmin,
    canSelectCtv,
    canViewSummaryReport: canAdmin || role === "MANAGER",
    enabledDetail: isCdtView,
    enabledSummary: isCdtReportView,
    hasSession: !!session?.user,
  });

  const cdtOutstandingPanel = useCdtOutstandingPanel({
    canAdmin,
    canSelectCtv,
    enabled: isCdtOutstandingView,
    hasSession: !!session?.user,
  });

  const disconnectPanel = useDisconnectPanel({
    canAdmin,
    canSelectCtv,
    enabled: isDisconnectView,
    hasSession: !!session?.user,
  });

  const cuocPanel = useCuocPanel({
    canAdmin,
    canViewCuoc,
    enabled: isCuocView,
    hasSession: !!session?.user,
  });

  const cuocCdPanel = useCuocCdPanel({
    canAdmin,
    canViewCuoc,
    enabled: isCuocCdView,
    hasSession: !!session?.user,
  });

  const kpiCalculatorPanel = useKpiCalculator({
    enabled: isKpiCalculatorView,
    hasSession: !!session?.user,
    canSelectCtv,
    selectedCtv,
    reportDate,
    onResolvedReportDate: (value) => {
      setReportDate(value);
      setDateInitialized(true);
    },
  });

  useEffect(() => {
    const init = async () => {
      if (!session?.user) return;
      if (canSelectCtv) {
        const res = await fetch("/api/me");
        if (res.ok) {
          const me = await res.json();
          const users = Array.isArray(me?.ctvList) ? me.ctvList : [];
          setCtvOptions(users);
          if (!selectedCtv && users.length > 0) setSelectedCtv(users[0].username);
        }
      }
    };
    void init();
  }, [canSelectCtv, selectedCtv, session?.user]);

  useEffect(() => {
    if (!session?.user || !isSummaryView) return;
    void fetchIndicatorList();
  }, [fetchIndicatorList, isSummaryView, session?.user]);

  useEffect(() => {
    if (!session?.user || !isManagerSummaryView) return;
    void fetchManagerIndicatorList();
  }, [fetchManagerIndicatorList, isManagerSummaryView, session?.user]);

  useEffect(() => {
    if (!session?.user) return;
    if (
      isOfficialView ||
      isCdtReportView ||
      isCdtView ||
      isCdtOutstandingView ||
      isDisconnectView ||
      isSummaryView ||
      isManagerSummaryView ||
      isCuocView ||
      isCuocCdView
    ) return;
    if (canSelectCtv && !selectedCtv) return;
    void fetchPersonal();
  }, [canSelectCtv, fetchPersonal, isCdtOutstandingView, isCdtReportView, isCdtView, isCuocCdView, isCuocView, isDisconnectView, isKpiCalculatorView, isManagerSummaryView, isOfficialView, isSummaryView, selectedCtv, session?.user]);

  useEffect(() => {
    setSummaryPage(1);
  }, [debouncedDate, debouncedIndicator, debouncedManagerFilter]);

  useEffect(() => {
    setManagerSummaryPage(1);
  }, [debouncedDate, debouncedManagerFilter, debouncedManagerIndicator]);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/kpi/import", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Import KPI thất bại");
      toast.success(`Import KPI thành công (${data.inserted} dòng)`);
      setReportDate("");
      setDateInitialized(false);
      await Promise.all([fetchPersonal({ force: true }), fetchIndicatorList({ force: true })]);
    } catch (error: any) {
      toast.error(error.message || "Import KPI thất bại");
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  const handleImportManagerKpi = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportingManagerKpi(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/kpi/manager-import", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Import KPI quản lý thất bại");
      toast.success(`Import KPI quản lý thành công (${data.inserted || 0} dòng)`);
      if (data?.reportDate) {
        setReportDate(String(data.reportDate));
        setDateInitialized(true);
      }
      await fetchManagerIndicatorList({ force: true });
    } catch (error: any) {
      toast.error(error?.message || "Import KPI quản lý thất bại");
    } finally {
      setImportingManagerKpi(false);
      e.target.value = "";
    }
  };


  const scorePercent = useMemo(() => {
    if (!totals.totalBaseScore) return 0;
    return Math.round((totals.totalAchievedScore / totals.totalBaseScore) * 1000) / 10;
  }, [totals]);

  const sortedReportRows = useMemo(() => sortKpiRowsByCompletion(reportRows), [reportRows]);

  const summarySortedRows = useMemo(() => sortKpiSummaryRowsByCompletion(summaryRows), [summaryRows]);
  const summaryVisibleRows = useMemo(
    () => summaryOnlyIncomplete ? filterIncompleteKpiSummaryRows(summarySortedRows) : summarySortedRows,
    [summaryOnlyIncomplete, summarySortedRows]
  );
  const summaryTotalPages = Math.max(1, Math.ceil(summaryVisibleRows.length / summaryPageSize));
  const summaryPagedRows = useMemo(
    () => summaryVisibleRows.slice((summaryPage - 1) * summaryPageSize, summaryPage * summaryPageSize),
    [summaryPage, summaryVisibleRows]
  );
  const summaryPagedMobileRows = useMemo(
    () => summaryVisibleRows.slice((summaryPage - 1) * summaryPageSize, summaryPage * summaryPageSize),
    [summaryPage, summaryVisibleRows]
  );
  const summaryCtvTotals = useMemo(
    () =>
      summaryRows.reduce(
        (acc, row) => {
          acc.kh += Number(row.kh || 0);
          acc.th += Number(row.th || 0);
          acc.thieu += Number(row.thieu || 0);
          return acc;
        },
        { kh: 0, th: 0, thieu: 0 }
      ),
    [summaryRows]
  );
  const summaryManagerTotals = useMemo(
    () =>
      summaryManagerRows.reduce(
        (acc, row) => {
          acc.kh += Number(row.kh || 0);
          acc.th += Number(row.th || 0);
          acc.thieu += Number(row.thieu || 0);
          return acc;
        },
        { kh: 0, th: 0, thieu: 0 }
      ),
    [summaryManagerRows]
  );
  const summaryTotals = useMemo(() => summaryCtvTotals, [summaryCtvTotals]);
  const isCuocSummaryIndicator = useMemo(
    () => isCuocN1N3MetricKey(selectedIndicator || debouncedIndicator),
    [debouncedIndicator, selectedIndicator]
  );
  const summaryTotalPercent = useMemo(() => {
    if (isCuocSummaryIndicator) {
      return computeCuocN1N3CompletionPercent(summaryTotals.th, {
        maxPercent: summaryMeta.maxPercent,
      });
    }
    return computeKpiCompletionPercent(summaryTotals.kh, summaryTotals.th, {
      isNegative: summaryMeta.isNegativeGroup,
      maxPercent: summaryMeta.maxPercent,
    });
  }, [isCuocSummaryIndicator, summaryMeta, summaryTotals]);
  const summaryMonthProgressPercent = useMemo(
    () => getMonthProgressPercent(reportDate || debouncedDate || new Date().toISOString().slice(0, 10)),
    [debouncedDate, reportDate]
  );
  const summaryDayCompletionPercent = useMemo(
    () => {
      if (isCuocSummaryIndicator) {
        return computeCuocN1N3CompletionPercent(summaryTotals.th, {
          maxPercent: summaryMeta.maxPercent,
        });
      }
      return computeKpiDayCompletionPercent(summaryTotals.kh, summaryTotals.th, summaryMonthProgressPercent, {
        isNegative: summaryMeta.isNegativeGroup,
        maxPercent: summaryMeta.maxPercent,
      });
    },
    [isCuocSummaryIndicator, summaryMeta, summaryMonthProgressPercent, summaryTotals]
  );
  const managerSummarySortedRows = useMemo(
    () => {
      const rows = selectedManagerIndicator === "__all__" ? managerSummaryAllRows : summaryManagerRows;
      if (selectedManagerIndicator === "__all__") return rows;
      return [...rows].sort((a, b) => {
        const pa = Number(a.percent || 0);
        const pb = Number(b.percent || 0);
        return pa - pb;
      });
    },
    [selectedManagerIndicator, managerSummaryAllRows, summaryManagerRows]
  );
  const managerSummaryTotalPages = Math.max(
    1,
    Math.ceil(
      (selectedManagerIndicator === "__all__" ? managerSummaryAllRows.length : summaryManagerRows.length) /
        (selectedManagerIndicator === "__all__" ? 10 : summaryPageSize)
    )
  );
  const managerSummaryPagedRows = useMemo(
    () => {
      if (selectedManagerIndicator === "__all__") return [];
      return managerSummarySortedRows.slice(
        (managerSummaryPage - 1) * summaryPageSize,
        managerSummaryPage * summaryPageSize
      );
    },
    [managerSummaryPage, selectedManagerIndicator, managerSummarySortedRows]
  );
  const managerSummaryPagedMobileRows = useMemo(
    () => {
      const size = selectedManagerIndicator === "__all__" ? 10 : summaryPageSize;
      return managerSummarySortedRows.slice((managerSummaryPage - 1) * size, managerSummaryPage * size);
    },
    [managerSummaryPage, selectedManagerIndicator, managerSummarySortedRows]
  );
  const isCuocManagerSummaryIndicator = useMemo(
    () => isCuocN1N3MetricKey(selectedManagerIndicator || debouncedManagerIndicator),
    [debouncedManagerIndicator, selectedManagerIndicator]
  );
  const managerSummaryTotalPercent = useMemo(() => {
    if (isCuocManagerSummaryIndicator) {
      return computeCuocN1N3CompletionPercent(summaryManagerTotals.th, {
        maxPercent: summaryManagerMeta.maxPercent,
      });
    }
    return computeKpiCompletionPercent(summaryManagerTotals.kh, summaryManagerTotals.th, {
      isNegative: summaryManagerMeta.isNegativeGroup,
      maxPercent: summaryManagerMeta.maxPercent,
    });
  }, [isCuocManagerSummaryIndicator, summaryManagerMeta, summaryManagerTotals]);
  const managerSummaryDayCompletionPercent = useMemo(
    () => {
      if (isCuocManagerSummaryIndicator) {
        return computeCuocN1N3CompletionPercent(summaryManagerTotals.th, {
          maxPercent: summaryManagerMeta.maxPercent,
        });
      }
      return computeKpiDayCompletionPercent(summaryManagerTotals.kh, summaryManagerTotals.th, summaryMonthProgressPercent, {
        isNegative: summaryManagerMeta.isNegativeGroup,
        maxPercent: summaryManagerMeta.maxPercent,
      });
    },
    [isCuocManagerSummaryIndicator, summaryManagerMeta, summaryManagerTotals, summaryMonthProgressPercent]
  );

  const managerOptions = useMemo(() => {
    const set = new Set<string>();
    for (const u of ctvOptions) {
      const code = String((u as any).managerCode || "").trim();
      if (code) set.add(code);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [ctvOptions]);





  const refreshSummaryView = useCallback(async () => {
    await fetchIndicatorList({ force: true });
  }, [fetchIndicatorList]);

  const refreshManagerSummaryView = useCallback(async () => {
    await fetchManagerIndicatorList({ force: true });
  }, [fetchManagerIndicatorList]);

  if (shouldRedirectManagerSummary || shouldRedirectKpiCalculator) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <Loader2 className="animate-spin" size={24} /> Đang chuyển hướng...</div>
      </div>
    );
  }

  if (isKpiCalculatorView && canViewKpiCalculator) {
    return (
      <KpiCalculatorPanel
        canSelectCtv={canSelectCtv}
        ctvOptions={ctvOptions}
        selectedCtv={selectedCtv}
        reportDate={reportDate}
        loading={kpiCalculatorPanel.loading}
        refreshing={kpiCalculatorPanel.refreshing}
        errorMessage={kpiCalculatorPanel.errorMessage}
        rows={kpiCalculatorPanel.rows}
        changeSummaryRows={kpiCalculatorPanel.changeSummary}
        draftValues={kpiCalculatorPanel.draftValues}
        dirtyCount={kpiCalculatorPanel.dirtyCount}
        totals={kpiCalculatorPanel.totals}
        surfaceActionBtnClass={surfaceActionBtnClass}
        surfacePrimaryBtnClass={surfacePrimaryBtnClass}
        surfaceBadgeClass={surfaceBadgeClass}
        surfaceChipClass={surfaceChipClass}
        getPercentBgClass={getPercentBgClass}
        getPercentClass={getPercentClass}
        getThieuBgClass={getThieuBgClass}
        getThieuClass={getThieuClass}
        onBack={() => router.push("/prepaid")}
        onSelectedCtvChange={setSelectedCtv}
        onReportDateChange={setReportDate}
        onRefresh={() => kpiCalculatorPanel.fetchCalculator({ force: true })}
        onReset={kpiCalculatorPanel.resetSimulation}
        onDraftValueChange={kpiCalculatorPanel.setDraftValue}
        onStepDraftValue={kpiCalculatorPanel.stepDraftValue}
        onSetTargetValue={kpiCalculatorPanel.setTargetValue}
      />
    );
  }

  if (isOfficialView) {
    return <OfficialDocsPanel role={role} onBack={() => router.push("/prepaid")} panel={officialDocsPanel} />;
  }
  if (isCdtReportView && (canAdmin || role === "MANAGER")) {
    return (
      <CdtSummaryPanelClean
        canAdmin={canAdmin}
        fromDate={cdtPanel.fromDate}
        toDate={cdtPanel.toDate}
        managerFilter={cdtPanel.managerFilter}
        managerOptions={managerOptions}
        dateRangeLabel={cdtPanel.dateRangeLabel}
        activeMobileFilterCount={cdtPanel.activeSummaryMobileFilterCount}
        showMobileFilters={cdtPanel.showSummaryMobileFilters}
        loading={cdtPanel.loading}
        refreshing={cdtPanel.refreshing}
        errorMessage={cdtPanel.summaryErrorMessage}
        rows={cdtPanel.summaryRows}
        totals={cdtPanel.summaryTotals}
        page={cdtPanel.summaryPage}
        totalPages={cdtPanel.summaryTotalPages}
        surfaceActionBtnClass={surfaceActionBtnClass}
        surfacePaginationBtnClass={surfacePaginationBtnClass}
        surfaceBadgeClass={surfaceBadgeClass}
        surfaceChipClass={surfaceChipClass}
        onBack={() => router.push("/prepaid?view=cdt")}
        onFromDateChange={cdtPanel.setFromDate}
        onToDateChange={cdtPanel.setToDate}
        onManagerFilterChange={cdtPanel.setManagerFilter}
        onRefresh={() => cdtPanel.fetchSummary({ force: true })}
        onToggleMobileFilters={cdtPanel.toggleSummaryMobileFilters}
        onCloseMobileFilters={() => {
          cdtPanel.closeSummaryMobileFilters();
          router.push("/prepaid?view=cdt");
        }}
        onPageChange={cdtPanel.setSummaryPage}
      />
    );
  }

  if (isCdtView) {
    return (
      <CdtPanelClean
        canAdmin={canAdmin}
        canSelectCtv={canSelectCtv}
        canViewSummaryReport={canAdmin || role === "MANAGER"}
        showActorColumn={canAdmin || role === "MANAGER"}
        fromDate={cdtPanel.fromDate}
        toDate={cdtPanel.toDate}
        accountFilter={cdtPanel.accountFilter}
        selectedCtv={cdtPanel.selectedCtv}
        managerFilter={cdtPanel.managerFilter}
        managerOptions={managerOptions}
        ctvOptions={ctvOptions}
        dateRangeLabel={cdtPanel.dateRangeLabel}
        activeMobileFilterCount={cdtPanel.activeMobileFilterCount}
        showMobileFilters={cdtPanel.showMobileFilters}
        loading={cdtPanel.loading}
        refreshing={cdtPanel.refreshing}
        importing={cdtPanel.importing}
        exportingMonth={cdtPanel.exportingMonth}
        errorMessage={cdtPanel.reportErrorMessage}
        rows={cdtPanel.rows}
        totals={cdtPanel.totals}
        page={cdtPanel.page}
        totalPages={cdtPanel.totalPages}
        surfaceActionBtnClass={surfaceActionBtnClass}
        surfacePrimaryBtnClass={surfacePrimaryBtnClass}
        surfacePaginationBtnClass={surfacePaginationBtnClass}
        surfaceBadgeClass={surfaceBadgeClass}
        surfaceChipClass={surfaceChipClass}
        formatIsoToVnDate={formatIsoToVnDate}
        getCdtTypeToneClass={getCdtTypeToneClass}
        onBack={() => router.push("/prepaid")}
        onOpenReport={() => router.push("/prepaid?view=cdt-report")}
        onOpenOutstanding={() => router.push("/prepaid?view=cdt-outstanding")}
        onExportMonth={cdtPanel.handleExportMonth}
        onImport={cdtPanel.handleImport}
        onFromDateChange={cdtPanel.setFromDate}
        onToDateChange={cdtPanel.setToDate}
        onAccountFilterChange={cdtPanel.setAccountFilter}
        onSelectedCtvChange={cdtPanel.setSelectedCtv}
        onManagerFilterChange={cdtPanel.setManagerFilter}
        onRefresh={() => cdtPanel.fetchReport({ force: true })}
        onToggleMobileFilters={cdtPanel.toggleMobileFilters}
        onPageChange={cdtPanel.setPage}
      />
    );
  }

  if (isCuocView && canViewCuoc) {
    return (
      <CuocPanelClean
        canAdmin={canAdmin}
        isCtv={role === "CTV"}
        reportDate={cuocPanel.reportDate}
        dateLabel={cuocPanel.dateLabel}
        targetRate={cuocPanel.targetRate}
        rateDirty={cuocPanel.rateDirty}
        savingRate={cuocPanel.savingRate}
        loading={cuocPanel.loading}
        refreshing={cuocPanel.refreshing}
        importing={cuocPanel.importing}
        showMobileFilters={cuocPanel.showMobileFilters}
        errorMessage={cuocPanel.errorMessage}
        rows={cuocPanel.rows}
        summaryRow={cuocPanel.summaryRow}
        pagedRows={cuocPanel.pagedRows}
        page={cuocPanel.page}
        totalPages={cuocPanel.totalPages}
        pageSize={cuocPanel.pageSize}
        surfaceActionBtnClass={surfaceActionBtnClass}
        surfacePrimaryBtnClass={surfacePrimaryBtnClass}
        surfacePaginationBtnClass={surfacePaginationBtnClass}
        surfaceBadgeClass={surfaceBadgeClass}
        surfaceChipClass={surfaceChipClass}
        getPercentBgClass={getPercentBgClass}
        getPercentClass={getPercentClass}
        getThieuBgClass={getThieuBgClass}
        getThieuClass={getThieuClass}
        getStatusLabel={getStatusLabel}
        onBack={() => router.push("/prepaid")}
        onReportDateChange={cuocPanel.setReportDate}
        onTargetRateChange={cuocPanel.onTargetRateChange}
        onSaveRate={cuocPanel.saveRate}
        onRefresh={() => cuocPanel.fetchReport({ force: true })}
        onImport={cuocPanel.handleImport}
        onToggleMobileFilters={cuocPanel.toggleMobileFilters}
        onPageChange={cuocPanel.setPage}
      />
    );
  }

  if (isCuocCdView && canViewCuoc) {
    return (
      <CuocCdPanelClean
        canAdmin={canAdmin}
        isCtv={role === "CTV"}
        reportDate={cuocCdPanel.reportDate}
        dateLabel={cuocCdPanel.dateLabel}
        targetRate={cuocCdPanel.targetRate}
        rateDirty={cuocCdPanel.rateDirty}
        savingRate={cuocCdPanel.savingRate}
        loading={cuocCdPanel.loading}
        refreshing={cuocCdPanel.refreshing}
        importing={cuocCdPanel.importing}
        showMobileFilters={cuocCdPanel.showMobileFilters}
        errorMessage={cuocCdPanel.errorMessage}
        rows={cuocCdPanel.rows}
        summaryRow={cuocCdPanel.summaryRow}
        pagedRows={cuocCdPanel.pagedRows}
        page={cuocCdPanel.page}
        totalPages={cuocCdPanel.totalPages}
        pageSize={cuocCdPanel.pageSize}
        surfaceActionBtnClass={surfaceActionBtnClass}
        surfacePrimaryBtnClass={surfacePrimaryBtnClass}
        surfacePaginationBtnClass={surfacePaginationBtnClass}
        surfaceBadgeClass={surfaceBadgeClass}
        surfaceChipClass={surfaceChipClass}
        onBack={() => router.push("/prepaid")}
        onReportDateChange={cuocCdPanel.setReportDate}
        onTargetRateChange={cuocCdPanel.onTargetRateChange}
        onSaveRate={cuocCdPanel.saveRate}
        onRefresh={() => cuocCdPanel.fetchReport({ force: true })}
        onImport={cuocCdPanel.handleImport}
        onToggleMobileFilters={cuocCdPanel.toggleMobileFilters}
        onPageChange={cuocCdPanel.setPage}
      />
    );
  }

  if (isManagerSummaryView && canViewManagerKpi) {
    return (
      <ManagerSummaryKpiPanelClean
        canAdmin={canAdmin}
        reportDate={reportDate}
        managerFilter={managerFilter}
        managerOptions={managerOptions}
        selectedManagerIndicator={selectedManagerIndicator}
        managerIndicators={managerIndicators}
        managerSummaryLoading={managerSummaryLoading}
        managerSummaryRefreshing={managerSummaryRefreshing}
        errorMessage={managerSummaryErrorMessage}
        importingManagerKpi={importingManagerKpi}
        summaryManagerRows={summaryManagerRows}
        managerSummaryAllRows={managerSummaryAllRows}
        summaryManagerTotals={summaryManagerTotals}
        managerSummaryTotalPercent={managerSummaryTotalPercent}
        managerSummaryDayCompletionPercent={managerSummaryDayCompletionPercent}
        managerSummaryPagedRows={managerSummaryPagedRows}
        managerSummaryPagedMobileRows={managerSummaryPagedMobileRows}
        managerSummaryPage={managerSummaryPage}
        managerSummaryTotalPages={managerSummaryTotalPages}
        summaryManagerMeta={summaryManagerMeta}
        summaryMonthProgressPercent={summaryMonthProgressPercent}
        isCuocManagerSummaryIndicator={isCuocManagerSummaryIndicator}
        surfaceActionBtnClass={surfaceActionBtnClass}
        surfacePrimaryBtnClass={surfacePrimaryBtnClass}
        surfacePaginationBtnClass={surfacePaginationBtnClass}
        surfaceBadgeClass={surfaceBadgeClass}
        surfaceChipClass={surfaceChipClass}
        getPercentBgClass={getPercentBgClass}
        getPercentClass={getPercentClass}
        getThieuBgClass={getThieuBgClass}
        getThieuClass={getThieuClass}
        getStatusLabel={getStatusLabel}
        formatMetricNumber={formatMetricNumber}
        formatMetricPercent={formatMetricPercent}
        computeCuocN1N3CompletionPercent={computeCuocN1N3CompletionPercent}
        computeKpiDayCompletionPercent={computeKpiDayCompletionPercent}
        onBack={() => router.push("/prepaid?view=summary")}
        onImportManagerKpi={handleImportManagerKpi}
        onReportDateChange={setReportDate}
        onManagerFilterChange={setManagerFilter}
        onRefresh={refreshManagerSummaryView}
        onIndicatorChange={setSelectedManagerIndicator}
        onPageChange={setManagerSummaryPage}
      />
    );
  }

  if (isCdtOutstandingView) {
    return (
      <CdtOutstandingPanelClean
        canAdmin={canAdmin}
        canSelectCtv={canSelectCtv}
        reportMonth={cdtOutstandingPanel.reportMonth}
        expiryMonth={cdtOutstandingPanel.expiryMonth}
        statusFilter={cdtOutstandingPanel.statusFilter}
        accountFilter={cdtOutstandingPanel.accountFilter}
        selectedCtv={cdtOutstandingPanel.selectedCtv}
        managerFilter={cdtOutstandingPanel.managerFilter}
        availableExpiryMonths={cdtOutstandingPanel.availableExpiryMonths}
        reportMonthLabel={cdtOutstandingPanel.reportMonthLabel}
        activeMobileFilterCount={cdtOutstandingPanel.activeMobileFilterCount}
        showMobileFilters={cdtOutstandingPanel.showMobileFilters}
        loading={cdtOutstandingPanel.loading}
        refreshing={cdtOutstandingPanel.refreshing}
        importing={cdtOutstandingPanel.importing}
        downloadingTemplate={cdtOutstandingPanel.downloadingTemplate}
        errorMessage={cdtOutstandingPanel.errorMessage}
        rows={cdtOutstandingPanel.rows}
        totals={cdtOutstandingPanel.totals}
        page={cdtOutstandingPanel.page}
        totalPages={cdtOutstandingPanel.totalPages}
        managerOptions={managerOptions}
        ctvOptions={ctvOptions}
        surfaceActionBtnClass={surfaceActionBtnClass}
        surfacePrimaryBtnClass={surfacePrimaryBtnClass}
        surfacePaginationBtnClass={surfacePaginationBtnClass}
        surfaceBadgeClass={surfaceBadgeClass}
        surfaceChipClass={surfaceChipClass}
        onBack={() => router.push("/prepaid?view=cdt")}
        onReportMonthChange={cdtOutstandingPanel.setReportMonth}
        onExpiryMonthChange={cdtOutstandingPanel.setExpiryMonth}
        onStatusFilterChange={cdtOutstandingPanel.setStatusFilter}
        onAccountFilterChange={cdtOutstandingPanel.setAccountFilter}
        onSelectedCtvChange={cdtOutstandingPanel.setSelectedCtv}
        onManagerFilterChange={cdtOutstandingPanel.setManagerFilter}
        onRefresh={() => cdtOutstandingPanel.fetchReport({ force: true })}
        onImport={cdtOutstandingPanel.handleImport}
        onDownloadTemplate={cdtOutstandingPanel.handleDownloadTemplate}
        onToggleMobileFilters={cdtOutstandingPanel.toggleMobileFilters}
        onPageChange={cdtOutstandingPanel.setPage}
      />
    );
  }

  if (isDisconnectView) {
    return (
      <DisconnectPanelClean
        canAdmin={canAdmin}
        canSelectCtv={canSelectCtv}
        reportMonth={disconnectPanel.reportMonth}
        cancelMonth={disconnectPanel.cancelMonth}
        sourceFilter={disconnectPanel.sourceFilter}
        importSourceType={disconnectPanel.importSourceType}
        accountFilter={disconnectPanel.accountFilter}
        selectedCtv={disconnectPanel.selectedCtv}
        managerFilter={disconnectPanel.managerFilter}
        availableCancelMonths={disconnectPanel.availableCancelMonths}
        reportMonthLabel={disconnectPanel.reportMonthLabel}
        activeMobileFilterCount={disconnectPanel.activeMobileFilterCount}
        showMobileFilters={disconnectPanel.showMobileFilters}
        loading={disconnectPanel.loading}
        refreshing={disconnectPanel.refreshing}
        importing={disconnectPanel.importing}
        downloadingTemplate={disconnectPanel.downloadingTemplate}
        errorMessage={disconnectPanel.errorMessage}
        rows={disconnectPanel.rows}
        totals={disconnectPanel.totals}
        page={disconnectPanel.page}
        totalPages={disconnectPanel.totalPages}
        managerOptions={managerOptions}
        ctvOptions={ctvOptions}
        surfaceActionBtnClass={surfaceActionBtnClass}
        surfacePrimaryBtnClass={surfacePrimaryBtnClass}
        surfacePaginationBtnClass={surfacePaginationBtnClass}
        surfaceBadgeClass={surfaceBadgeClass}
        surfaceChipClass={surfaceChipClass}
        onBack={() => router.push("/prepaid")}
        onReportMonthChange={disconnectPanel.setReportMonth}
        onCancelMonthChange={disconnectPanel.setCancelMonth}
        onSourceFilterChange={disconnectPanel.setSourceFilter}
        onImportSourceTypeChange={disconnectPanel.setImportSourceType}
        onAccountFilterChange={disconnectPanel.setAccountFilter}
        onSelectedCtvChange={disconnectPanel.setSelectedCtv}
        onManagerFilterChange={disconnectPanel.setManagerFilter}
        onRefresh={() => disconnectPanel.fetchReport({ force: true })}
        onImport={disconnectPanel.handleImport}
        onDownloadTemplate={disconnectPanel.handleDownloadTemplate}
        onToggleMobileFilters={disconnectPanel.toggleMobileFilters}
        onPageChange={disconnectPanel.setPage}
      />
    );
  }

  if (isSummaryView && canViewSummary) {
    return (
      <SummaryKpiPanelClean
        canAdmin={canAdmin}
        reportDate={reportDate}
        managerFilter={managerFilter}
        managerOptions={managerOptions}
        selectedIndicator={selectedIndicator}
        indicators={indicators}
        summaryLoading={summaryLoading}
        summaryRefreshing={summaryRefreshing}
        errorMessage={summaryErrorMessage}
        summaryRows={summaryRows}
        summaryTotals={summaryTotals}
        summaryTotalPercent={summaryTotalPercent}
        summaryDayCompletionPercent={summaryDayCompletionPercent}
        summaryPagedRows={summaryPagedRows}
        summaryPagedMobileRows={summaryPagedMobileRows}
        summaryPage={summaryPage}
        summaryTotalPages={summaryTotalPages}
        summaryOnlyIncomplete={summaryOnlyIncomplete}
        summaryVisibleCount={summaryVisibleRows.length}
        summaryMeta={summaryMeta}
        summaryMonthProgressPercent={summaryMonthProgressPercent}
        isCuocSummaryIndicator={isCuocSummaryIndicator}
        surfaceActionBtnClass={surfaceActionBtnClass}
        surfacePaginationBtnClass={surfacePaginationBtnClass}
        surfaceBadgeClass={surfaceBadgeClass}
        surfaceChipClass={surfaceChipClass}
        getPercentBgClass={getPercentBgClass}
        getPercentClass={getPercentClass}
        getThieuBgClass={getThieuBgClass}
        getThieuClass={getThieuClass}
        getStatusLabel={getStatusLabel}
        formatMetricNumber={formatMetricNumber}
        formatMetricPercent={formatMetricPercent}
        computeCuocN1N3CompletionPercent={computeCuocN1N3CompletionPercent}
        computeKpiDayCompletionPercent={computeKpiDayCompletionPercent}
        onBack={() => router.push("/prepaid")}
        onReportDateChange={setReportDate}
        onManagerFilterChange={setManagerFilter}
        onRefresh={refreshSummaryView}
        onIndicatorChange={setSelectedIndicator}
        onSummaryPageChange={setSummaryPage}
        onOnlyIncompleteChange={(value) => {
          setSummaryOnlyIncomplete(value);
          setSummaryPage(1);
        }}
      />
    );
  }

  return (
    <PersonalKpiPanelClean
      canAdmin={canAdmin}
      canSelectCtv={canSelectCtv}
      ctvOptions={ctvOptions}
      selectedCtv={selectedCtv}
      reportDate={reportDate}
      importing={importing}
      refreshing={refreshing}
      loading={loading}
      errorMessage={personalErrorMessage}
      reportRows={sortedReportRows}
      mobileSortedRows={sortedReportRows}
      scorePercent={scorePercent}
      totals={totals}
      surfaceActionBtnClass={surfaceActionBtnClass}
      surfacePrimaryBtnClass={surfacePrimaryBtnClass}
      surfacePrimaryBadgeClass={surfacePrimaryBadgeClass}
      surfaceBadgeClass={surfaceBadgeClass}
      surfaceChipClass={surfaceChipClass}
      getPercentBgClass={getPercentBgClass}
      getPercentClass={getPercentClass}
      getStatusLabel={getStatusLabel}
      onSelectedCtvChange={setSelectedCtv}
      onReportDateChange={setReportDate}
      onRefresh={() => fetchPersonal({ force: true })}
      onImport={handleImport}
    />
  );
}










