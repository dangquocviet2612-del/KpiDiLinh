"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { CalendarDays, ChevronDown, ChevronUp, Download, Loader2, Upload } from "lucide-react";
import {
  DISCONNECT_SOURCE_FTTH,
  DISCONNECT_SOURCE_TV,
  formatDisconnectCancelMonthLabel,
  formatDisconnectReportMonthLabel,
  getDisconnectSourceLabel,
  type DisconnectSourceType,
} from "@/lib/disconnect";
import { buildDisconnectMobileFilterSummary, isDisconnectPastCancelDate } from "@/lib/disconnect-ui";
import PrepaidPanelState from "./PrepaidPanelState";
import styles from "./kpi.module.css";

const TEXT = {
  title: "Rời mạng",
  subtitle: "Theo dõi danh sách thuê bao tạm ngưng dự kiến hủy theo kỳ file cho Truyền hình và FTTH.",
  back: "Quay lại KPI",
  downloadTemplate: "Tải file mẫu",
  upload: "Tải file rời mạng",
  reportMonth: "Kỳ file",
  cancelMonth: "Tháng hủy",
  sourceFilter: "Nguồn",
  importSource: "Nguồn tải lên",
  currentSource: "Nguồn hiện tại",
  account: "Thuê bao",
  advancedFilters: "Bộ lọc nâng cao",
  allMonths: "Tất cả tháng",
  allSources: "Tất cả nguồn",
  allCtv: "Tất cả CTV",
  allManagers: "Tất cả quản lý",
  filters: "Bộ lọc",
  refresh: "Làm mới dữ liệu",
  refreshing: "Đang làm mới dữ liệu...",
  total: "Tổng thuê bao",
  totalHelp: "Toàn bộ thuê bao trong kỳ file hiện tại",
  upcoming: "Chưa quá ngày hủy",
  upcomingHelp: "Hôm nay hoặc chưa tới ngày hủy theo hệ thống.",
  overdue: "Quá ngày hủy",
  overdueHelp: "Đã qua ngày hủy theo hệ thống.",
  emptyTitle: "Chưa có dữ liệu rời mạng",
  emptyDescription: "Thử điều chỉnh kỳ file, tháng hủy, nguồn hoặc bộ lọc để xem danh sách rời mạng.",
  stt: "STT",
  service: "Dịch vụ",
  ctv: "CTV",
  manager: "Quản lý",
  suspendedDate: "Ngày chặn",
  cancelDate: "Ngày hủy",
  page: "Trang",
  prev: "Trước",
  next: "Sau",
  unknown: "Chưa rõ",
  source: "Nguồn",
} as const;

const SOURCE_OPTIONS: Array<{ value: DisconnectSourceType; label: string }> = [
  { value: DISCONNECT_SOURCE_TV, label: getDisconnectSourceLabel(DISCONNECT_SOURCE_TV) },
  { value: DISCONNECT_SOURCE_FTTH, label: getDisconnectSourceLabel(DISCONNECT_SOURCE_FTTH) },
];

type CtvOption = {
  id: string | number;
  username: string;
};

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

type DisconnectPanelCleanProps = {
  canAdmin: boolean;
  canSelectCtv: boolean;
  reportMonth: string;
  cancelMonth: string;
  sourceFilter: string;
  importSourceType: DisconnectSourceType;
  accountFilter: string;
  selectedCtv: string;
  managerFilter: string;
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
  managerOptions: string[];
  ctvOptions: CtvOption[];
  surfaceActionBtnClass: string;
  surfacePrimaryBtnClass: string;
  surfacePaginationBtnClass: string;
  surfaceBadgeClass: string;
  surfaceChipClass: string;
  onBack: () => void;
  onReportMonthChange: (value: string) => void;
  onCancelMonthChange: (value: string) => void;
  onSourceFilterChange: (value: string) => void;
  onImportSourceTypeChange: (value: DisconnectSourceType) => void;
  onAccountFilterChange: (value: string) => void;
  onSelectedCtvChange: (value: string) => void;
  onManagerFilterChange: (value: string) => void;
  onRefresh: () => void;
  onImport: (event: ChangeEvent<HTMLInputElement>) => void;
  onDownloadTemplate: () => void;
  onToggleMobileFilters: () => void;
  onPageChange: (value: number | ((current: number) => number)) => void;
};

export default function DisconnectPanelClean(props: DisconnectPanelCleanProps) {
  const importSourceLabel = getDisconnectSourceLabel(props.importSourceType);
  const advancedFiltersRef = useRef<HTMLDivElement | null>(null);
  const desktopActionsRef = useRef<HTMLDivElement | null>(null);
  const desktopImportInputRef = useRef<HTMLInputElement | null>(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showDesktopActions, setShowDesktopActions] = useState(false);
  const canShowAdvancedFiltersTrigger = props.canSelectCtv || props.canAdmin;
  const overdueRatio = props.totals.total > 0 ? props.totals.overdue / props.totals.total : 0;
  const overdueRatioPercent = Math.max(0, Math.min(100, Math.round(overdueRatio * 100)));
  const overdueRatioBarWidth = Math.max(0, Math.min(100, overdueRatio * 100));
  const todayIso = new Date().toISOString().slice(0, 10);
  const mobileFilterSummary = buildDisconnectMobileFilterSummary({
    activeCount: props.activeMobileFilterCount,
    cancelMonthLabel: props.cancelMonth ? formatDisconnectCancelMonthLabel(props.cancelMonth) : undefined,
    sourceLabel: props.sourceFilter ? getDisconnectSourceLabel(props.sourceFilter) : undefined,
  });

  const closeDesktopMenus = useCallback(() => {
    setShowAdvancedFilters(false);
    setShowDesktopActions(false);
  }, []);

  const handleRefresh = useCallback(() => {
    closeDesktopMenus();
    props.onRefresh();
  }, [closeDesktopMenus, props]);

  const handleDownloadTemplate = useCallback(() => {
    closeDesktopMenus();
    props.onDownloadTemplate();
  }, [closeDesktopMenus, props]);

  const handleUploadTrigger = useCallback(() => {
    closeDesktopMenus();
    desktopImportInputRef.current?.click();
  }, [closeDesktopMenus]);

  useEffect(() => {
    if (!showAdvancedFilters && !showDesktopActions) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;

      if (showAdvancedFilters && advancedFiltersRef.current && !advancedFiltersRef.current.contains(target)) {
        setShowAdvancedFilters(false);
      }

      if (showDesktopActions && desktopActionsRef.current && !desktopActionsRef.current.contains(target)) {
        setShowDesktopActions(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [showAdvancedFilters, showDesktopActions]);

  useEffect(() => {
    if (!showAdvancedFilters && !showDesktopActions) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeDesktopMenus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [closeDesktopMenus, showAdvancedFilters, showDesktopActions]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className="ui-panel-heading">
          <h1 className={`${styles.title} ui-panel-title`}>{TEXT.title}</h1>
          <p className={`${styles.subtitle} ui-panel-subtitle`}>{TEXT.subtitle}</p>
        </div>
        <div className={styles.cdtHeaderActions}>
          <button className={props.surfaceActionBtnClass} onClick={props.onBack}>
            {TEXT.back}
          </button>
          {props.canAdmin ? (
            <>
              <button
                className={`${props.surfaceActionBtnClass} ${styles.cdtMobileHeaderAction}`}
                onClick={props.onDownloadTemplate}
                disabled={props.downloadingTemplate}
              >
                {props.downloadingTemplate ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                {TEXT.downloadTemplate} {importSourceLabel}
              </button>
              <label className={`${props.surfacePrimaryBtnClass} ${styles.cdtMobileHeaderAction}`}>
                {props.importing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                {TEXT.upload} {importSourceLabel}
                <input type="file" accept=".xlsx,.xls" hidden onChange={props.onImport} disabled={props.importing} />
              </label>
            </>
          ) : null}
        </div>
      </div>

      <div className={`glass-panel ${styles.toolbar} ${styles.mobileStickyFilter} ${styles.cdtDesktopToolbar}`}>
        <div className={styles.outstandingToolbarFilters}>
          <div className={styles.toolbarField}>
            <span className={styles.toolbarFieldLabel}>{TEXT.reportMonth}</span>
            <input
              type="month"
              className="input-base"
              value={props.reportMonth}
              onChange={(event) => props.onReportMonthChange(event.target.value)}
            />
          </div>
          <div className={styles.toolbarField}>
            <span className={styles.toolbarFieldLabel}>{TEXT.cancelMonth}</span>
            <select
              className="input-base"
              value={props.cancelMonth}
              onChange={(event) => props.onCancelMonthChange(event.target.value)}
            >
              <option value="">{TEXT.allMonths}</option>
              {props.availableCancelMonths.map((month) => (
                <option key={`disconnect-cancel-${month}`} value={month}>
                  {formatDisconnectCancelMonthLabel(month)}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.toolbarField}>
            <span className={styles.toolbarFieldLabel}>{TEXT.sourceFilter}</span>
            <select className="input-base" value={props.sourceFilter} onChange={(event) => props.onSourceFilterChange(event.target.value)}>
              <option value="">{TEXT.allSources}</option>
              {SOURCE_OPTIONS.map((option) => (
                <option key={`disconnect-source-${option.value}`} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className={`${styles.toolbarField} ${styles.outstandingAccountField}`}>
            <span className={styles.toolbarFieldLabel}>{TEXT.account}</span>
            <input
              className="input-base"
              placeholder="Tìm theo thuê bao"
              value={props.accountFilter}
              onChange={(event) => props.onAccountFilterChange(event.target.value)}
            />
          </div>
          {canShowAdvancedFiltersTrigger ? (
            <div
              ref={advancedFiltersRef}
              className={styles.toolbarPopoverWrap}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setShowAdvancedFilters(false);
                }
              }}
            >
              <button
                type="button"
                className={props.surfaceActionBtnClass}
                onClick={() => {
                  setShowDesktopActions(false);
                  setShowAdvancedFilters((current) => !current);
                }}
                aria-expanded={showAdvancedFilters}
              >
                {TEXT.advancedFilters}
                {showAdvancedFilters ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {showAdvancedFilters ? (
                <div className={styles.toolbarPopover}>
                  {props.canSelectCtv ? (
                    <div className={styles.toolbarField}>
                      <span className={styles.toolbarFieldLabel}>{TEXT.ctv}</span>
                      <select
                        className="input-base"
                        value={props.selectedCtv}
                        onChange={(event) => props.onSelectedCtvChange(event.target.value)}
                      >
                        <option value="">{TEXT.allCtv}</option>
                        {props.ctvOptions.map((user) => (
                          <option key={`disconnect-ctv-${user.id}`} value={user.username}>
                            {user.username}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                  {props.canAdmin ? (
                    <>
                      <div className={styles.toolbarField}>
                        <span className={styles.toolbarFieldLabel}>{TEXT.manager}</span>
                        <select
                          className="input-base"
                          value={props.managerFilter}
                          onChange={(event) => props.onManagerFilterChange(event.target.value)}
                        >
                          <option value="">{TEXT.allManagers}</option>
                          {props.managerOptions.map((manager) => (
                            <option key={`disconnect-manager-${manager}`} value={manager}>
                              {manager}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className={styles.toolbarField}>
                        <span className={styles.toolbarFieldLabel}>{TEXT.importSource}</span>
                        <select
                          className="input-base"
                          value={props.importSourceType}
                          onChange={(event) => props.onImportSourceTypeChange(event.target.value as DisconnectSourceType)}
                        >
                          {SOURCE_OPTIONS.map((option) => (
                            <option key={`disconnect-import-source-${option.value}`} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className={styles.outstandingToolbarActions}>
          <button type="button" className={props.surfaceActionBtnClass} onClick={handleRefresh}>
            {TEXT.refresh}
          </button>
          {props.canAdmin ? (
            <div
              ref={desktopActionsRef}
              className={styles.toolbarPopoverWrap}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setShowDesktopActions(false);
                }
              }}
            >
              <button
                type="button"
                className={props.surfaceActionBtnClass}
                onClick={() => {
                  setShowAdvancedFilters(false);
                  setShowDesktopActions((current) => !current);
                }}
                aria-expanded={showDesktopActions}
              >
                Thao tác
                {showDesktopActions ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {showDesktopActions ? (
                <div className={`${styles.toolbarPopover} ${styles.toolbarPopoverEnd}`}>
                  <div className={styles.toolbarPopoverContext}>
                    <span className={styles.toolbarPopoverContextLabel}>{TEXT.currentSource}</span>
                    <strong className={styles.toolbarPopoverContextValue}>{importSourceLabel}</strong>
                  </div>
                  <button
                    type="button"
                    className={styles.toolbarMenuItem}
                    onClick={handleDownloadTemplate}
                    disabled={props.downloadingTemplate}
                  >
                    {props.downloadingTemplate ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                    {TEXT.downloadTemplate}
                  </button>
                  <button
                    type="button"
                    className={styles.toolbarMenuItem}
                    onClick={handleUploadTrigger}
                    disabled={props.importing}
                  >
                    {props.importing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                    {TEXT.upload}
                  </button>
                </div>
              ) : null}

              <input
                ref={desktopImportInputRef}
                type="file"
                accept=".xlsx,.xls"
                hidden
                onChange={props.onImport}
                disabled={props.importing}
              />
            </div>
          ) : null}
          {props.refreshing ? <span className={styles.refreshHint}>{TEXT.refreshing}</span> : null}
        </div>
      </div>

      <div className={`glass-panel ${styles.mobileStickyFilter} ${styles.cdtMobileToolbar}`}>
        <div className={styles.cdtMobileToolbarSummary}>
          <div className={styles.cdtMobileDateSummary} title={props.reportMonthLabel}>
            <CalendarDays size={16} />
            <span>{props.reportMonthLabel}</span>
          </div>
          <button
            type="button"
            className={`${props.surfaceActionBtnClass} ${styles.cdtMobileFilterToggle}`}
            onClick={props.onToggleMobileFilters}
            aria-expanded={props.showMobileFilters}
          >
            <span>
              {props.activeMobileFilterCount > 0 ? `${TEXT.filters} (${props.activeMobileFilterCount})` : TEXT.filters}
            </span>
            {props.showMobileFilters ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
        {props.activeMobileFilterCount > 0 ? (
          <div className={styles.disconnectMobileFilterMeta}>
            <div
              className={`${props.surfaceChipClass} ${styles.disconnectMobileFilterSummary}`}
              title={mobileFilterSummary.detail ? `${mobileFilterSummary.title} · ${mobileFilterSummary.detail}` : mobileFilterSummary.title}
            >
              <span className={styles.disconnectMobileFilterSummaryTitle}>{mobileFilterSummary.title}</span>
              {mobileFilterSummary.detail ? <span className={styles.disconnectMobileFilterSummaryDetail}>{mobileFilterSummary.detail}</span> : null}
            </div>
          </div>
        ) : null}
        {props.showMobileFilters ? (
          <div className={styles.cdtMobileFilterPanel}>
            <div className={styles.toolbarField}>
              <span className={styles.toolbarFieldLabel}>{TEXT.reportMonth}</span>
              <input
                type="month"
                className="input-base"
                value={props.reportMonth}
                onChange={(event) => props.onReportMonthChange(event.target.value)}
              />
            </div>
            <div className={styles.toolbarField}>
              <span className={styles.toolbarFieldLabel}>{TEXT.cancelMonth}</span>
              <select
                className="input-base"
                value={props.cancelMonth}
                onChange={(event) => props.onCancelMonthChange(event.target.value)}
              >
                <option value="">{TEXT.allMonths}</option>
                {props.availableCancelMonths.map((month) => (
                  <option key={`disconnect-mobile-cancel-${month}`} value={month}>
                    {formatDisconnectCancelMonthLabel(month)}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.toolbarField}>
              <span className={styles.toolbarFieldLabel}>{TEXT.sourceFilter}</span>
              <select className="input-base" value={props.sourceFilter} onChange={(event) => props.onSourceFilterChange(event.target.value)}>
                <option value="">{TEXT.allSources}</option>
                {SOURCE_OPTIONS.map((option) => (
                  <option key={`disconnect-mobile-source-${option.value}`} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <input
              className="input-base"
              placeholder="Tìm theo thuê bao"
              value={props.accountFilter}
              onChange={(event) => props.onAccountFilterChange(event.target.value)}
            />
            {props.canSelectCtv ? (
              <select
                className="input-base"
                value={props.selectedCtv}
                onChange={(event) => props.onSelectedCtvChange(event.target.value)}
              >
                <option value="">{TEXT.allCtv}</option>
                {props.ctvOptions.map((user) => (
                  <option key={`disconnect-mobile-ctv-${user.id}`} value={user.username}>
                    {user.username}
                  </option>
                ))}
              </select>
            ) : null}
            {props.canAdmin ? (
              <>
                <select
                  className="input-base"
                  value={props.managerFilter}
                  onChange={(event) => props.onManagerFilterChange(event.target.value)}
                >
                  <option value="">{TEXT.allManagers}</option>
                  {props.managerOptions.map((manager) => (
                    <option key={`disconnect-mobile-manager-${manager}`} value={manager}>
                      {manager}
                    </option>
                  ))}
                </select>
                <div className={styles.toolbarField}>
                  <span className={styles.toolbarFieldLabel}>{TEXT.importSource}</span>
                  <select
                    className="input-base"
                    value={props.importSourceType}
                    onChange={(event) => props.onImportSourceTypeChange(event.target.value as DisconnectSourceType)}
                  >
                    {SOURCE_OPTIONS.map((option) => (
                      <option key={`disconnect-mobile-import-source-${option.value}`} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : null}
            <div className={styles.cdtMobileActionGrid}>
              <button className={props.surfaceActionBtnClass} onClick={props.onRefresh}>
                {TEXT.refresh}
              </button>
              {props.canAdmin ? (
                <>
                  <button
                    className={props.surfaceActionBtnClass}
                    onClick={props.onDownloadTemplate}
                    disabled={props.downloadingTemplate}
                  >
                    {props.downloadingTemplate ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                    {TEXT.downloadTemplate} {importSourceLabel}
                  </button>
                  <label className={`${props.surfacePrimaryBtnClass} ${styles.cdtMobileUploadBtn}`}>
                    {props.importing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                    {TEXT.upload} {importSourceLabel}
                    <input type="file" accept=".xlsx,.xls" hidden onChange={props.onImport} disabled={props.importing} />
                  </label>
                </>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <PrepaidPanelState
        loading={props.loading}
        errorMessage={props.errorMessage}
        isEmpty={props.rows.length === 0}
        emptyTitle={TEXT.emptyTitle}
        emptyDescription={TEXT.emptyDescription}
        onRetry={props.onRefresh}
        actionBtnClass={props.surfaceActionBtnClass}
        skeletonStats={3}
        skeletonRows={5}
        skeletonCompact
      >
        <div className={`glass-panel ${styles.disconnectSummaryStatsGrid} ${styles.cdtDesktopStats}`}>
          <div className={`glass-panel ${styles.disconnectSummaryStatCard}`}>
            <div className={styles.disconnectSummaryStatHead}>
              <span className={styles.disconnectSummaryLabel}>{TEXT.total}</span>
              <strong>{props.totals.total.toLocaleString("vi-VN")}</strong>
            </div>
            <span className={styles.disconnectSummaryMeta}>{TEXT.totalHelp}</span>
          </div>
          <div className={`glass-panel ${styles.disconnectSummaryStatCard}`}>
            <div className={styles.disconnectSummaryStatHead}>
              <span className={styles.disconnectSummaryLabel}>{TEXT.upcoming}</span>
              <strong className={styles.warn}>{props.totals.upcoming.toLocaleString("vi-VN")}</strong>
            </div>
            <span className={styles.disconnectSummaryMeta}>{TEXT.upcomingHelp}</span>
          </div>
          <div className={`glass-panel ${styles.disconnectSummaryStatCard}`}>
            <div className={styles.disconnectSummaryStatHead}>
              <span className={styles.disconnectSummaryLabel}>{TEXT.overdue}</span>
              <strong className={styles.bad}>{props.totals.overdue.toLocaleString("vi-VN")}</strong>
            </div>
            <div className={styles.disconnectSummaryRatioBlock}>
              <div className={styles.disconnectSummaryRatioRow}>
                <span className={styles.disconnectSummaryRatioLabel}>Quá ngày / Tổng</span>
                <strong className={styles.disconnectSummaryRatioValue}>{overdueRatioPercent}%</strong>
              </div>
              <div
                className={styles.disconnectSummaryRatioTrack}
                aria-hidden="true"
                title={`${props.totals.overdue.toLocaleString("vi-VN")} / ${props.totals.total.toLocaleString("vi-VN")}`}
              >
                <span style={{ width: `${overdueRatioBarWidth}%` }} />
              </div>
              <span className={styles.disconnectSummaryRatioMeta}>
                {props.totals.overdue.toLocaleString("vi-VN")} / {props.totals.total.toLocaleString("vi-VN")}
              </span>
            </div>
            <span className={styles.disconnectSummaryMeta}>{TEXT.overdueHelp}</span>
          </div>
        </div>

        <div className={`glass-panel ${styles.cdtMobileStatsGrid}`}>
          <div className={styles.cdtMobileStatCard}>
            <span>{TEXT.total}</span>
            <strong>{props.totals.total.toLocaleString("vi-VN")}</strong>
            <small>{TEXT.totalHelp}</small>
          </div>
          <div className={styles.cdtMobileStatCard}>
            <span>{TEXT.upcoming}</span>
            <strong className={styles.warn}>{props.totals.upcoming.toLocaleString("vi-VN")}</strong>
            <small>{TEXT.upcomingHelp}</small>
          </div>
          <div className={styles.cdtMobileStatCard}>
            <span>{TEXT.overdue}</span>
            <strong className={styles.bad}>{props.totals.overdue.toLocaleString("vi-VN")}</strong>
            <small>{TEXT.overdueHelp}</small>
          </div>
        </div>

        <div className={`glass-panel ${styles.tableWrap}`}>
          <table className={styles.table}>
            <colgroup>
              <col style={{ width: "72px" }} />
              <col style={{ width: "20%" }} />
              <col style={{ width: "24%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "16%" }} />
            </colgroup>
            <thead>
              <tr>
                <th>{TEXT.stt}</th>
                <th>{TEXT.account}</th>
                <th>{TEXT.service}</th>
                <th>{TEXT.ctv}</th>
                <th>{TEXT.suspendedDate}</th>
                <th>{TEXT.cancelDate}</th>
              </tr>
            </thead>
            <tbody>
              {props.rows.map((row, index) => (
                <tr key={row.id}>
                  <td className={styles.numberCell}>{(props.page - 1) * 40 + index + 1}</td>
                  <td className={styles.nameCell}>{row.account}</td>
                  <td>
                    <div className={styles.disconnectServiceCell}>
                      <span>{row.serviceName || TEXT.unknown}</span>
                      <span className={`${props.surfaceChipClass} ${styles.disconnectSourceBadge}`}>{getDisconnectSourceLabel(row.sourceType)}</span>
                    </div>
                  </td>
                  <td>{row.ctvCode}</td>
                  <td>
                    <div className={styles.disconnectDateCell}>
                      <strong>{row.suspendedDateText || TEXT.unknown}</strong>
                      <span>{row.suspendedDateIso || ""}</span>
                    </div>
                  </td>
                  <td>
                    <div className={styles.disconnectDateCell}>
                      <strong>{row.cancelDateText || TEXT.unknown}</strong>
                      <span>{formatDisconnectReportMonthLabel(row.cancelMonth)}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className={styles.mobileCards}>
            {props.rows.map((row) => {
              const isOverdue = isDisconnectPastCancelDate(row.cancelDateIso, todayIso);
              const mobileCardStatusClass = isOverdue ? styles.disconnectMobileCardOverdue : styles.disconnectMobileCardUpcoming;
              const mobileBadgeStatusClass = isOverdue ? styles.disconnectDateBadgeOverdue : styles.disconnectDateBadgeUpcoming;

              return (
                <div key={`disconnect-mobile-${row.id}`} className={`${styles.mobileCard} ${styles.cdtMobileCard} ${styles.disconnectMobileCard} ${mobileCardStatusClass}`}>
                  <div className={`${styles.mobileHeader} ${styles.cdtMobileHeader}`}>
                    <div className={`${styles.mobileTitle} ${styles.cdtAccount}`}>{row.account}</div>
                    <span className={`${props.surfaceBadgeClass} ${styles.cdtDateBadge} ${mobileBadgeStatusClass}`}>
                      {row.cancelDateText || TEXT.unknown}
                    </span>
                  </div>
                  <div className={styles.mobileSummaryRows}>
                    <div className={styles.mobileSummaryLine}>
                      <span className={`${props.surfaceChipClass} ${styles.chip}`}>{TEXT.service}: {row.serviceName || TEXT.unknown}</span>
                    </div>
                    <div className={styles.mobileSummaryLine}>
                      <span className={`${props.surfaceChipClass} ${styles.chip}`}>CTV: {row.ctvCode}</span>
                      <span className={`${props.surfaceChipClass} ${styles.chip}`}>{TEXT.source}: {getDisconnectSourceLabel(row.sourceType)}</span>
                    </div>
                    <div className={styles.mobileSummaryLine}>
                      <span className={`${props.surfaceChipClass} ${styles.chip}`}>{TEXT.suspendedDate}: {row.suspendedDateText || TEXT.unknown}</span>
                      <span className={`${props.surfaceChipClass} ${styles.chip}`}>{TEXT.cancelDate}: {row.cancelDateText || TEXT.unknown}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className={styles.pagination}>
          <button
            className={props.surfacePaginationBtnClass}
            disabled={props.page <= 1}
            onClick={() => props.onPageChange((current) => Math.max(1, current - 1))}
          >
            {TEXT.prev}
          </button>
          <span className={styles.pageInfo}>
            {TEXT.page} {props.page}/{props.totalPages}
          </span>
          <button
            className={props.surfacePaginationBtnClass}
            disabled={props.page >= props.totalPages}
            onClick={() => props.onPageChange((current) => Math.min(props.totalPages, current + 1))}
          >
            {TEXT.next}
          </button>
        </div>
      </PrepaidPanelState>
    </div>
  );
}


