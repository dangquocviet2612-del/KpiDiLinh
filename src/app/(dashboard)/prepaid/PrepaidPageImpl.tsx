"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
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
import { kpiReportRequestKey, useLatestKpiRequest } from "@/hooks/useLatestKpiRequest";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { CurrentUserRequestError } from "@/lib/current-user-request";
import {
  filterIncompleteKpiSummaryRows,
  sortKpiSummaryRowsByCompletion,
} from "@/lib/kpi-summary";
import PersonalKpiPanelClean from "./PersonalKpiPanelClean";
import PrepaidPanelLoading from "./PrepaidPanelLoading";
import useCdtPanel from "./useCdtPanel";
import useCdtOutstandingPanel from "./useCdtOutstandingPanel";
import useDisconnectPanel from "./useDisconnectPanel";
import useKpiCalculator from "./useKpiCalculator";
import useCuocPanel from "./useCuocPanel";
import useCuocCdPanel from "./useCuocCdPanel";
import useOfficialDocsPanel from "./useOfficialDocsPanel";
import styles from "./kpi.module.css";

const CdtPanelClean = dynamic(() => import("./CdtPanelClean"), { loading: PrepaidPanelLoading });
const KpiCalculatorPanel = dynamic(() => import("./KpiCalculatorPanel"), { loading: PrepaidPanelLoading });
const CdtOutstandingPanelClean = dynamic(() => import("./CdtOutstandingPanelClean"), { loading: PrepaidPanelLoading });
const CdtSummaryPanelClean = dynamic(() => import("./CdtSummaryPanelClean"), { loading: PrepaidPanelLoading });
const CuocPanelClean = dynamic(() => import("./CuocPanelClean"), { loading: PrepaidPanelLoading });
const CuocCdPanelClean = dynamic(() => import("./CuocCdPanelClean"), { loading: PrepaidPanelLoading });
const DisconnectPanelClean = dynamic(() => import("./DisconnectPanelClean"), { loading: PrepaidPanelLoading });
const OfficialDocsPanel = dynamic(() => import("./OfficialDocsPanel"), { loading: PrepaidPanelLoading });
const ManagerSummaryKpiPanelClean = dynamic(() => import("./ManagerSummaryKpiPanelClean"), { loading: PrepaidPanelLoading });
const SummaryKpiPanelClean = dynamic(() => import("./SummaryKpiPanelClean"), { loading: PrepaidPanelLoading });

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

type SummaryPayload<Row> = {
  rows?: Row[];
  allRows?: any[];
  indicators?: string[];
  selectedGroup?: string;
  reportDate?: string | null;
  isNegativeGroup?: boolean;
  maxPercent?: number;
};

type SummaryRequestOptions = { force?: boolean; latest?: boolean; reportDate?: string };

const summaryRequestKey = (resource: string, scope: string, date: string, manager: string, group: string) =>
  JSON.stringify([resource, scope, date, manager, group]);

const resolveSummaryGroup = (data: SummaryPayload<unknown>, requestedGroup: string, manager = false) => {
  if (manager && requestedGroup === "__all__") return "__all__";
  const groups = (data.indicators || []).filter((group) => !manager || group !== "__all__");
  return String(data.selectedGroup || "").trim() ||
    (requestedGroup && groups.includes(requestedGroup) ? requestedGroup : groups[0] || "");
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
  const hasSession = Boolean(session?.user);
  const scopeKey = JSON.stringify([session?.user?.id || "", session?.user?.name || "", role]);
  const currentUser = useCurrentUser(hasSession && canSelectCtv);
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
  const [storedCtvOptions, setCtvOptions] = useState<any[]>([]);
  const [storedSelectedCtv, setSelectedCtv] = useState("");
  const [ctvScope, setCtvScope] = useState(currentUser.scope);
  const ctvOptions = useMemo(() => ctvScope === currentUser.scope ? storedCtvOptions : [], [ctvScope, currentUser.scope, storedCtvOptions]);
  const selectedCtv = ctvScope === currentUser.scope ? storedSelectedCtv : "";
  const ctvReady = !canSelectCtv || Boolean(currentUser.data && ctvScope === currentUser.scope && selectedCtv &&
    Array.isArray(currentUser.data.ctvList) && currentUser.data.ctvList.some((user) => user.username === selectedCtv));
  const [reportDate, setReportDate] = useState("");
  const [calculatorDataRevision, setCalculatorDataRevision] = useState(0);
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
  const hasPersonalDataRef = useRef(false);
  const { run: runPersonal, cancel: cancelPersonal, reset: resetPersonal } = useLatestKpiRequest<{ rows?: KpiRow[]; reportDate?: string | null; totalBaseScore?: number; totalAchievedScore?: number }>();
  const { run: runSummary, cancel: cancelSummary, reset: resetSummary } = useLatestKpiRequest<SummaryPayload<SummaryRow>>();
  const { run: runManagerSummary, cancel: cancelManagerSummary, reset: resetManagerSummary } = useLatestKpiRequest<SummaryPayload<ManagerSummaryRow>>();
  const hasSummaryDataRef = useRef(false);
  const hasManagerSummaryDataRef = useRef(false);
  const summaryReentryRef = useRef(true);
  const managerSummaryReentryRef = useRef(true);
  const managerSummaryLatestRef = useRef(false);
  const [summaryScope, setSummaryScope] = useState(scopeKey);
  const personalEnabled = hasSession && !(
    isOfficialView || isCdtReportView || isCdtView || isCdtOutstandingView || isDisconnectView ||
    isSummaryView || isManagerSummaryView || isCuocView || isCuocCdView || isKpiCalculatorView
  );
  const summaryEnabled = hasSession && isSummaryView && canViewSummary;
  const managerSummaryEnabled = hasSession && isManagerSummaryView && canViewManagerKpi;
  const summaryContextRef = useRef({
    mounted: true, scopeKey, personalEnabled, summaryEnabled, managerSummaryEnabled,
    reportDate, managerFilter, selectedIndicator, selectedManagerIndicator,
  });

  useEffect(() => {
    summaryContextRef.current = {
      mounted: true, scopeKey, personalEnabled, summaryEnabled, managerSummaryEnabled,
      reportDate, managerFilter, selectedIndicator, selectedManagerIndicator,
    };
  }, [managerFilter, managerSummaryEnabled, personalEnabled, reportDate, scopeKey, selectedIndicator, selectedManagerIndicator, summaryEnabled]);

  useEffect(() => () => { summaryContextRef.current.mounted = false; }, []);

  useEffect(() => {
    resetSummary();
    resetManagerSummary();
    hasSummaryDataRef.current = false;
    hasManagerSummaryDataRef.current = false;
    summaryReentryRef.current = true;
    managerSummaryReentryRef.current = true;
    managerSummaryLatestRef.current = false;
    setSummaryScope(scopeKey);
    setSummaryRows([]);
    setSummaryManagerRows([]);
    setManagerSummaryAllRows([]);
    setIndicators([]);
    setManagerIndicators([]);
    setSelectedIndicator("");
    setSelectedManagerIndicator("");
    setDebouncedIndicator("");
    setDebouncedManagerIndicator("");
    setManagerFilter("");
    setDebouncedManagerFilter("");
    setCtvOptions([]);
    setSelectedCtv("");
    setDebouncedCtv("");
    setCtvScope(currentUser.scope);
    setSummaryMeta({ isNegativeGroup: false, maxPercent: DEFAULT_KPI_MAX_PERCENT });
    setSummaryManagerMeta({ isNegativeGroup: false, maxPercent: DEFAULT_KPI_MAX_PERCENT });
    setSummaryErrorMessage(null);
    setManagerSummaryErrorMessage(null);
    setSummaryLoading(false);
    setSummaryRefreshing(false);
    setManagerSummaryLoading(false);
    setManagerSummaryRefreshing(false);
  }, [currentUser.scope, resetManagerSummary, resetSummary, scopeKey]);

  useEffect(() => {
    resetPersonal();
    hasPersonalDataRef.current = false;
    setReportRows([]);
    setTotals({ totalBaseScore: 0, totalAchievedScore: 0 });
  }, [resetPersonal, scopeKey]);
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

  const fetchPersonal = useCallback(async (options?: { force?: boolean; latest?: boolean }) => {
    if (!hasSession || !ctvReady) return;
    if (canSelectCtv && (!debouncedCtv || debouncedCtv !== selectedCtv)) return;
    const ctv = canSelectCtv ? debouncedCtv : "";
    const requestedDate = options?.latest ? "" : debouncedDate;
    const hadPersonalData = hasPersonalDataRef.current;
    return runPersonal({
      key: kpiReportRequestKey(scopeKey, ctv, requestedDate),
      force: options?.force,
      resolvedKeys: (data) => [kpiReportRequestKey(scopeKey, ctv, data.reportDate || requestedDate)],
      onStart: () => {
        setPersonalErrorMessage(null);
        if (!hadPersonalData) setLoading(true);
        else setRefreshing(true);
      },
      load: async (signal) => {
        const params = new URLSearchParams();
        if (ctv) params.set("ctvUser", ctv);
        if (requestedDate) params.set("reportDate", requestedDate);
        const res = await fetch(`/api/kpi/report?${params.toString()}`, { signal });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Không tải được dữ liệu KPI");
        return data;
      },
      onSuccess: (data) => {
        setPersonalErrorMessage(null);
        setReportRows(data.rows || []);
        hasPersonalDataRef.current = true;
        setTotals({ totalBaseScore: Number(data.totalBaseScore || 0), totalAchievedScore: Number(data.totalAchievedScore || 0) });
        if (data.reportDate && (!dateInitialized || options?.latest)) {
          setReportDate(data.reportDate);
          setDateInitialized(true);
        }
      },
      onError: (error) => {
        const nextError = error instanceof Error ? error.message : "Không tải được dữ liệu KPI";
        setPersonalErrorMessage(nextError);
        toast.error(nextError);
        if (!hadPersonalData) {
          setReportRows([]);
          setTotals({ totalBaseScore: 0, totalAchievedScore: 0 });
        }
      },
      onSettled: () => {
        setLoading(false);
        setRefreshing(false);
      },
    });
  }, [canSelectCtv, ctvReady, dateInitialized, debouncedCtv, debouncedDate, hasSession, runPersonal, scopeKey, selectedCtv]);

  const fetchPersonalRef = useRef(fetchPersonal);
  useLayoutEffect(() => {
    fetchPersonalRef.current = fetchPersonal;
  }, [fetchPersonal]);

  const fetchIndicatorList = useCallback(async (options?: SummaryRequestOptions) => {
    const context = summaryContextRef.current;
    if (!context.mounted || !context.summaryEnabled || context.scopeKey !== scopeKey) return;
    const requestedDate = options?.latest ? "" : options?.reportDate ?? (options?.force ? context.reportDate : debouncedDate);
    const requestedManager = canAdmin ? (options?.force ? context.managerFilter : debouncedManagerFilter) : "";
    const requestedGroup = options?.force ? context.selectedIndicator : debouncedIndicator;
    const requestKey = (date: string, group: string) => summaryRequestKey("summary", scopeKey, date, requestedManager, group);
    const hadSummaryData = hasSummaryDataRef.current;
    return runSummary({
      key: requestKey(requestedDate, requestedGroup),
      force: options?.force,
      resolvedKeys: (data) => {
        const resolvedDate = data.reportDate && (!dateInitialized || options?.latest) ? data.reportDate : requestedDate;
        const resolvedGroup = resolveSummaryGroup(data, requestedGroup);
        return [requestKey(requestedDate, resolvedGroup), requestKey(resolvedDate, requestedGroup), requestKey(resolvedDate, resolvedGroup)];
      },
      onStart: () => {
        setSummaryErrorMessage(null);
        if (!hadSummaryData) setSummaryLoading(true);
        else setSummaryRefreshing(true);
      },
      load: async (signal) => {
        const params = new URLSearchParams();
        if (requestedDate) params.set("reportDate", requestedDate);
        if (requestedManager) params.set("managerCode", requestedManager);
        if (requestedGroup) params.set("group", requestedGroup);
        const res = await fetch(`/api/kpi/summary?${params.toString()}`, { signal });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Không tải được tổng hợp KPI");
        return data;
      },
      onSuccess: (data) => {
        setSummaryErrorMessage(null);
        setIndicators(Array.isArray(data.indicators) ? data.indicators : []);
        setSelectedIndicator(resolveSummaryGroup(data, requestedGroup));
        setSummaryRows(data.rows || []);
        setSummaryMeta({
          isNegativeGroup: Boolean(data.isNegativeGroup),
          maxPercent: Number(data.maxPercent ?? DEFAULT_KPI_MAX_PERCENT),
        });
        hasSummaryDataRef.current = true;
        if (data.reportDate && (!dateInitialized || options?.latest)) {
          setReportDate(data.reportDate);
          setDateInitialized(true);
        }
      },
      onError: (error) => {
        const nextError = error instanceof Error ? error.message : "Không tải được tổng hợp KPI";
        setSummaryErrorMessage(nextError);
        toast.error(nextError);
        if (!hadSummaryData) {
          setIndicators([]);
          setSummaryRows([]);
          setSummaryMeta({ isNegativeGroup: false, maxPercent: DEFAULT_KPI_MAX_PERCENT });
        }
      },
      onSettled: () => {
        setSummaryLoading(false);
        setSummaryRefreshing(false);
      },
    });
  }, [canAdmin, dateInitialized, debouncedDate, debouncedIndicator, debouncedManagerFilter, runSummary, scopeKey]);

  const fetchManagerIndicatorList = useCallback(async (options?: SummaryRequestOptions) => {
    const context = summaryContextRef.current;
    if (!context.mounted || !context.managerSummaryEnabled || context.scopeKey !== scopeKey) return;
    const latest = options?.latest || managerSummaryLatestRef.current;
    const requestedDate = latest ? "" : options?.reportDate ?? (options?.force ? context.reportDate : debouncedDate);
    const requestedManager = canAdmin ? (options?.force ? context.managerFilter : debouncedManagerFilter) : "";
    const requestedGroup = options?.force ? context.selectedManagerIndicator : debouncedManagerIndicator;
    const requestKey = (date: string, group: string) => summaryRequestKey("manager-summary", scopeKey, date, requestedManager, group);
    const hadManagerSummaryData = hasManagerSummaryDataRef.current;
    return runManagerSummary({
      key: requestKey(requestedDate, requestedGroup),
      force: options?.force,
      resolvedKeys: (data) => {
        const resolvedDate = data.reportDate && (!dateInitialized || latest) ? data.reportDate : requestedDate;
        const resolvedGroup = resolveSummaryGroup(data, requestedGroup, true);
        return [requestKey(requestedDate, resolvedGroup), requestKey(resolvedDate, requestedGroup), requestKey(resolvedDate, resolvedGroup)];
      },
      onStart: () => {
        setManagerSummaryErrorMessage(null);
        if (!hadManagerSummaryData) setManagerSummaryLoading(true);
        else setManagerSummaryRefreshing(true);
      },
      load: async (signal) => {
        const params = new URLSearchParams();
        if (requestedDate) params.set("reportDate", requestedDate);
        if (requestedManager) params.set("managerCode", requestedManager);
        if (requestedGroup) params.set("group", requestedGroup);
        const res = await fetch(`/api/kpi/manager-summary?${params.toString()}`, { signal });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Không tải được KPI quản lý");
        return data;
      },
      onSuccess: (data) => {
        setManagerSummaryErrorMessage(null);
        const rawIndicators = Array.isArray(data.indicators) ? data.indicators : [];
        setManagerIndicators(rawIndicators.filter((group) => group !== "__all__"));
        setSelectedManagerIndicator(resolveSummaryGroup(data, requestedGroup, true));
        setSummaryManagerRows(data.rows || []);
        setManagerSummaryAllRows(data.allRows || []);
        setSummaryManagerMeta({
          isNegativeGroup: Boolean(data.isNegativeGroup),
          maxPercent: Number(data.maxPercent ?? DEFAULT_KPI_MAX_PERCENT),
        });
        hasManagerSummaryDataRef.current = true;
        managerSummaryLatestRef.current = false;
        if (data.reportDate && (!dateInitialized || latest)) {
          setReportDate(data.reportDate);
          setDateInitialized(true);
        }
      },
      onError: (error) => {
        const nextError = error instanceof Error ? error.message : "Không tải được KPI quản lý";
        setManagerSummaryErrorMessage(nextError);
        toast.error(nextError);
        if (!hadManagerSummaryData) {
          setManagerIndicators([]);
          setSummaryManagerRows([]);
          setManagerSummaryAllRows([]);
          setSummaryManagerMeta({ isNegativeGroup: false, maxPercent: DEFAULT_KPI_MAX_PERCENT });
        }
      },
      onSettled: () => {
        setManagerSummaryLoading(false);
        setManagerSummaryRefreshing(false);
      },
    });
  }, [canAdmin, dateInitialized, debouncedDate, debouncedManagerFilter, debouncedManagerIndicator, runManagerSummary, scopeKey]);


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

  const handleResolvedReportDate = useCallback((value: string) => {
    setReportDate(value);
    setDateInitialized(true);
  }, []);

  const kpiCalculatorPanel = useKpiCalculator({
    enabled: isKpiCalculatorView,
    hasSession: hasSession && ctvReady,
    canSelectCtv,
    selectedCtv,
    reportDate,
    onResolvedReportDate: handleResolvedReportDate,
    scopeKey: JSON.stringify([scopeKey, calculatorDataRevision]),
  });

  useEffect(() => {
    if (!currentUser.data) return;
    const users = Array.isArray(currentUser.data.ctvList) ? currentUser.data.ctvList : [];
    setCtvOptions(users);
    setSelectedCtv((current) => users.some((user) => user.username === current) ? current : users[0]?.username || "");
  }, [currentUser.data]);

  useEffect(() => {
    if (currentUser.error instanceof CurrentUserRequestError && currentUser.error.status === null) {
      toast.error("Không tải được danh sách CTV");
    }
  }, [currentUser.error]);

  useEffect(() => {
    if (!summaryEnabled) {
      cancelSummary();
      summaryReentryRef.current = true;
      setSummaryLoading(false);
      setSummaryRefreshing(false);
      return;
    }
    if (summaryScope !== scopeKey || debouncedDate !== reportDate || debouncedIndicator !== selectedIndicator ||
      (canAdmin && debouncedManagerFilter !== managerFilter)) {
      cancelSummary();
      setSummaryLoading(!hasSummaryDataRef.current);
      setSummaryRefreshing(hasSummaryDataRef.current);
      return;
    }
    void fetchIndicatorList({ force: summaryReentryRef.current });
    summaryReentryRef.current = false;
  }, [canAdmin, cancelSummary, debouncedDate, debouncedIndicator, debouncedManagerFilter, fetchIndicatorList, managerFilter, reportDate, scopeKey, selectedIndicator, summaryEnabled, summaryScope]);

  useEffect(() => {
    if (!managerSummaryEnabled) {
      cancelManagerSummary();
      managerSummaryReentryRef.current = true;
      setManagerSummaryLoading(false);
      setManagerSummaryRefreshing(false);
      return;
    }
    if (summaryScope !== scopeKey || debouncedDate !== reportDate || debouncedManagerIndicator !== selectedManagerIndicator ||
      (canAdmin && debouncedManagerFilter !== managerFilter)) {
      cancelManagerSummary();
      setManagerSummaryLoading(!hasManagerSummaryDataRef.current);
      setManagerSummaryRefreshing(hasManagerSummaryDataRef.current);
      return;
    }
    void fetchManagerIndicatorList({ force: managerSummaryReentryRef.current });
    managerSummaryReentryRef.current = false;
  }, [canAdmin, cancelManagerSummary, debouncedDate, debouncedManagerFilter, debouncedManagerIndicator, fetchManagerIndicatorList, managerFilter, managerSummaryEnabled, reportDate, scopeKey, selectedManagerIndicator, summaryScope]);

  useEffect(() => {
    if (!hasSession || !ctvReady) { cancelPersonal(); return; }
    if (
      isOfficialView ||
      isCdtReportView ||
      isCdtView ||
      isCdtOutstandingView ||
      isDisconnectView ||
      isSummaryView ||
      isManagerSummaryView ||
      isCuocView ||
      isCuocCdView ||
      isKpiCalculatorView
    ) { cancelPersonal(); return; }
    if (canSelectCtv && (!debouncedCtv || debouncedCtv !== selectedCtv)) { cancelPersonal(); return; }
    if (debouncedDate !== reportDate) { cancelPersonal(); return; }
    void fetchPersonal();
  }, [cancelPersonal, canSelectCtv, ctvReady, debouncedCtv, debouncedDate, fetchPersonal, hasSession, isCdtOutstandingView, isCdtReportView, isCdtView, isCuocCdView, isCuocView, isDisconnectView, isKpiCalculatorView, isManagerSummaryView, isOfficialView, isSummaryView, reportDate, selectedCtv]);

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
      const context = summaryContextRef.current;
      if (!context.mounted || context.scopeKey !== scopeKey) return;
      toast.success(`Import KPI thành công (${data.inserted} dòng)`);
      resetPersonal();
      resetSummary();
      resetManagerSummary();
      setCalculatorDataRevision((current) => current + 1);
      setReportDate("");
      setDebouncedDate("");
      setDateInitialized(false);
      if (context.personalEnabled) await fetchPersonalRef.current({ force: true, latest: true });
      else if (context.summaryEnabled) await fetchIndicatorList({ force: true, latest: true });
      else if (context.managerSummaryEnabled) await fetchManagerIndicatorList({ force: true, latest: true });
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
      const context = summaryContextRef.current;
      if (!context.mounted || context.scopeKey !== scopeKey) return;
      toast.success(`Import KPI quản lý thành công (${data.inserted || 0} dòng)`);
      resetManagerSummary();
      const importedDate = data.reportDate ? String(data.reportDate) : "";
      managerSummaryLatestRef.current = !importedDate;
      setReportDate(importedDate);
      setDebouncedDate(importedDate);
      setDateInitialized(Boolean(importedDate));
      await fetchManagerIndicatorList({ force: true, reportDate: importedDate, latest: !importedDate });
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

  const handleExplicitReportDateChange = useCallback((value: string) => {
    managerSummaryLatestRef.current = false;
    setReportDate(value);
  }, []);

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
        hasDraftEdits={kpiCalculatorPanel.hasDraftEdits}
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
        onReportDateChange={handleExplicitReportDateChange}
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
        onReportDateChange={handleExplicitReportDateChange}
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
        onReportDateChange={handleExplicitReportDateChange}
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
      onReportDateChange={handleExplicitReportDateChange}
      onRefresh={() => fetchPersonal({ force: true })}
      onImport={handleImport}
    />
  );
}










