import { useMemo, useState, type ChangeEvent } from "react";
import { ListFilter, Upload, UserRound } from "lucide-react";
import {
  filterIncompleteManagerKpiRows,
  prioritizeManagerKpiRows,
  sortManagerKpiMetricsByCompletion,
} from "@/lib/manager-kpi-summary";
import { isCuocN1N3MetricKey } from "@/lib/kpi-scoring";
import styles from "./kpi.module.css";
import PrepaidPanelState from "./PrepaidPanelState";

type ManagerSummaryRow = {
  managerUser: string;
  managerName?: string | null;
  jobTitle?: string | null;
  kh: number;
  th: number;
  percent: number;
  thieu: number;
};

type ManagerSummaryAllRow = {
  managerUser: string;
  managerName?: string | null;
  jobTitle?: string | null;
  metrics: Array<{
    name: string;
    kh: number;
    th: number;
    percent: number;
    thieu: number;
    metricCode: string;
    isNegative: boolean;
    maxPercent: number;
  }>;
};

type SummaryMeta = {
  isNegativeGroup: boolean;
  maxPercent: number;
};

type SummaryTotals = {
  kh: number;
  th: number;
  thieu: number;
};

type ManagerSummaryKpiPanelCleanProps = {
  canAdmin: boolean;
  reportDate: string;
  managerFilter: string;
  managerOptions: string[];
  selectedManagerIndicator: string;
  managerIndicators: string[];
  managerSummaryLoading: boolean;
  managerSummaryRefreshing: boolean;
  importingManagerKpi: boolean;
  errorMessage: string | null;
  summaryManagerRows: ManagerSummaryRow[];
  managerSummaryAllRows?: ManagerSummaryAllRow[];
  summaryManagerTotals: SummaryTotals;
  managerSummaryTotalPercent: number;
  managerSummaryDayCompletionPercent: number;
  managerSummaryPagedRows: ManagerSummaryRow[];
  managerSummaryPagedMobileRows: ManagerSummaryRow[];
  managerSummaryPage: number;
  managerSummaryTotalPages: number;
  summaryManagerMeta: SummaryMeta;
  summaryMonthProgressPercent: number;
  isCuocManagerSummaryIndicator: boolean;
  surfaceActionBtnClass: string;
  surfacePrimaryBtnClass: string;
  surfacePaginationBtnClass: string;
  surfaceBadgeClass: string;
  surfaceChipClass: string;
  getPercentBgClass: (percent: number) => string;
  getPercentClass: (percent: number) => string;
  getThieuBgClass: (value: number) => string;
  getThieuClass: (value: number) => string;
  getStatusLabel: (percent: number) => string;
  formatMetricNumber: (value: number) => string;
  formatMetricPercent: (value: number) => string;
  computeCuocN1N3CompletionPercent: (value: number, options?: { maxPercent?: number }) => number;
  computeKpiDayCompletionPercent: (
    kh: number,
    th: number,
    monthProgressPercent: number,
    options?: { isNegative?: boolean; maxPercent?: number }
  ) => number;
  onBack: () => void;
  onImportManagerKpi: (event: ChangeEvent<HTMLInputElement>) => void;
  onReportDateChange: (value: string) => void;
  onManagerFilterChange: (value: string) => void;
  onRefresh: () => void;
  onIndicatorChange: (value: string) => void;
  onPageChange: (value: number | ((current: number) => number)) => void;
};

const EMPTY_MANAGER_SUMMARY_ROWS: ManagerSummaryAllRow[] = [];

export default function ManagerSummaryKpiPanelClean(props: ManagerSummaryKpiPanelCleanProps) {
  const isAllView = props.selectedManagerIndicator === "__all__";
  const allRows = props.managerSummaryAllRows ?? EMPTY_MANAGER_SUMMARY_ROWS;
  const [onlyIncomplete, setOnlyIncomplete] = useState(false);
  const detailGapLabel = props.summaryManagerMeta.isNegativeGroup ? "Vượt ngưỡng" : "Còn thiếu";

  const allViewStats = useMemo(() => {
    const metrics = allRows.flatMap((row) => row.metrics);
    return {
      incomplete: metrics.filter((metric) => Number(metric.percent || 0) < 100).length,
      achieved: metrics.filter((metric) => Number(metric.percent || 0) >= 100).length,
    };
  }, [allRows]);

  const visibleAllRows = useMemo(() => {
    const rows = onlyIncomplete ? filterIncompleteManagerKpiRows(allRows) : allRows;
    return prioritizeManagerKpiRows(rows);
  }, [allRows, onlyIncomplete]);

  // Pagination for the __all__ view
  const pageSize = 10;
  const totalAllPages = Math.max(1, Math.ceil(visibleAllRows.length / pageSize));
  const pagedAllRows = visibleAllRows.slice(
    (props.managerSummaryPage - 1) * pageSize,
    props.managerSummaryPage * pageSize
  );

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className="ui-panel-heading">
          <h1 className={`${styles.title} ui-panel-title`}>
            {isAllView ? "Tổng hợp KPI Quản lý" : "KPI Quản lý"}
          </h1>
          <p className={`${styles.subtitle} ui-panel-subtitle`}>
            {isAllView
              ? "Xem báo cáo tổng hợp tất cả chỉ tiêu của các quản lý."
              : "Xem phần chỉ tiêu quản lý tự thực hiện theo từng quản lý."}
          </p>
        </div>
        <div className={styles.summaryHeaderActions}>
          <button className={props.surfaceActionBtnClass} onClick={props.onBack}>
            Quay lại Tổng hợp KPI
          </button>
          {props.canAdmin && (
            <label className={props.surfacePrimaryBtnClass}>
              <Upload size={16} />
              <span>{props.importingManagerKpi ? "Đang tải KPI QL..." : "Tải KPI QL"}</span>
              <input
                type="file"
                accept=".xlsx,.xls"
                hidden
                onChange={props.onImportManagerKpi}
                disabled={props.importingManagerKpi}
              />
            </label>
          )}
        </div>
      </div>

      <div className={styles.tabContainer} role="tablist" aria-label="Chế độ xem KPI quản lý">
        <button
          type="button"
          role="tab"
          aria-selected={!isAllView}
          className={`${styles.tabBtn} ${!isAllView ? styles.tabBtnActive : ""}`}
          onClick={() => {
            if (props.managerIndicators.length > 0) {
              props.onIndicatorChange(props.managerIndicators[0]);
            }
          }}
        >
          🔍 Xem chi tiết từng chỉ tiêu
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={isAllView}
          className={`${styles.tabBtn} ${isAllView ? styles.tabBtnActive : ""}`}
          onClick={() => {
            props.onIndicatorChange("__all__");
          }}
        >
          📊 Tổng hợp tất cả chỉ tiêu
        </button>
      </div>

      <div className={`glass-panel ${styles.toolbar} ${styles.mobileStickyFilter}`}>
        <label className={styles.toolbarField}>
          <span className={styles.toolbarFieldLabel}>Ngày báo cáo</span>
          <input
            type="date"
            className="input-base"
            value={props.reportDate}
            onChange={(event) => props.onReportDateChange(event.target.value)}
          />
        </label>
        {props.canAdmin && (
          <label className={styles.toolbarField}>
            <span className={styles.toolbarFieldLabel}>Quản lý</span>
            <select
              className="input-base"
              value={props.managerFilter}
              onChange={(event) => props.onManagerFilterChange(event.target.value)}
            >
              <option value="">Tất cả quản lý</option>
              {props.managerOptions.map((manager) => (
                <option key={manager} value={manager}>
                  {manager}
                </option>
              ))}
            </select>
          </label>
        )}
        <button className={props.surfaceActionBtnClass} onClick={props.onRefresh}>
          Làm mới KPI quản lý
        </button>
        {!isAllView && (
          <label className={styles.toolbarField}>
            <span className={styles.toolbarFieldLabel}>Chỉ tiêu</span>
            <select
              className="input-base"
              value={props.selectedManagerIndicator}
              onChange={(event) => props.onIndicatorChange(event.target.value)}
            >
              {props.managerIndicators.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        )}
        {isAllView && (
          <>
            <button
              type="button"
              className={`${props.surfaceActionBtnClass} ${onlyIncomplete ? styles.managerFilterActive : ""}`}
              aria-pressed={onlyIncomplete}
              onClick={() => {
                setOnlyIncomplete((current) => !current);
                props.onPageChange(1);
              }}
            >
              <ListFilter size={16} />
              Chỉ hiện chưa đạt
            </button>
            <div className={styles.managerSummaryCounts} aria-label="Thống kê trạng thái KPI">
              <span className={`${props.surfaceChipClass} ${styles.managerCountIncomplete}`}>
                Chưa đạt: {allViewStats.incomplete}
              </span>
              <span className={props.surfaceChipClass}>Đã đạt: {allViewStats.achieved}</span>
            </div>
          </>
        )}
        {props.managerSummaryRefreshing && (
          <span className={styles.refreshHint}>Đang làm mới dữ liệu...</span>
        )}
      </div>

      <PrepaidPanelState
        loading={props.managerSummaryLoading}
        errorMessage={props.errorMessage}
        isEmpty={isAllView ? allRows.length === 0 : props.summaryManagerRows.length === 0}
        emptyTitle="Chưa có dữ liệu KPI quản lý"
        emptyDescription="Thử đổi ngày báo cáo, bộ lọc quản lý hoặc tải lên file KPI QL mới."
        onRetry={props.onRefresh}
        actionBtnClass={props.surfaceActionBtnClass}
        skeletonStats={5}
        skeletonRows={6}
      >
        <div className={styles.tableWrap}>
          {!isAllView ? (
            <>
              <div className={`glass-panel ${styles.kpiCards} ${styles.summaryStatsGrid}`}>
                <div className={`${styles.kpiStat} ${styles.summaryStatCard}`}>
                  <span>Tổng KH</span>
                  <strong>{props.formatMetricNumber(props.summaryManagerTotals.kh)}</strong>
                </div>
                <div className={`${styles.kpiStat} ${styles.summaryStatCard}`}>
                  <span>Tổng TH</span>
                  <strong>{props.formatMetricNumber(props.summaryManagerTotals.th)}</strong>
                </div>
                <div className={`${styles.kpiStat} ${styles.summaryStatCard}`}>
                  <span>Hoàn thành</span>
                  <strong className={props.getPercentClass(props.managerSummaryTotalPercent)}>
                    {props.formatMetricPercent(props.managerSummaryTotalPercent)}
                  </strong>
                </div>
                <div className={`${styles.kpiStat} ${styles.summaryStatCard}`}>
                  <span>{detailGapLabel}</span>
                  <strong className={props.getThieuClass(props.summaryManagerTotals.thieu)}>
                    {props.formatMetricNumber(props.summaryManagerTotals.thieu)}
                  </strong>
                </div>
                <div className={`${styles.kpiStat} ${styles.summaryStatCard}`}>
                  <span>% HT ngày</span>
                  <strong className={props.getPercentClass(props.managerSummaryDayCompletionPercent)}>
                    {props.formatMetricPercent(props.managerSummaryDayCompletionPercent)}
                  </strong>
                </div>
              </div>

              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.stickyFirst}>Quản lý</th>
                    <th>KH</th>
                    <th>TH</th>
                    <th>%</th>
                    <th>% HT ngày</th>
                    <th>{detailGapLabel}</th>
                  </tr>
                </thead>
                <tbody>
                  {props.managerSummaryPagedRows.map((row) => {
                    const percent = Number(row.percent || 0);
                    const dayPercent = props.isCuocManagerSummaryIndicator
                      ? props.computeCuocN1N3CompletionPercent(Number(row.th || 0), {
                          maxPercent: props.summaryManagerMeta.maxPercent,
                        })
                      : props.computeKpiDayCompletionPercent(
                          Number(row.kh || 0),
                          Number(row.th || 0),
                          props.summaryMonthProgressPercent,
                          {
                            isNegative: props.summaryManagerMeta.isNegativeGroup,
                            maxPercent: props.summaryManagerMeta.maxPercent,
                          }
                        );

                    return (
                      <tr key={row.managerUser}>
                        <td className={`${styles.stickyFirst} ${styles.nameCell}`}>
                          <div>{row.managerUser}</div>
                          {(row.managerName || row.jobTitle) && (
                            <div className={styles.summaryManagerMeta}>
                              {[row.managerName, row.jobTitle].filter(Boolean).join(" • ")}
                            </div>
                          )}
                        </td>
                        <td>{props.formatMetricNumber(row.kh)}</td>
                        <td>{props.formatMetricNumber(row.th)}</td>
                        <td className={`${styles.metricCell} ${props.getPercentBgClass(percent)}`}>
                          <span className={props.getPercentClass(percent)}>
                            {props.formatMetricPercent(percent)}
                          </span>
                          <div className={styles.progress}>
                            <span style={{ width: `${Math.min(Math.max(percent, 0), 130)}%` }} />
                          </div>
                        </td>
                        <td className={`${styles.metricCell} ${props.getPercentBgClass(dayPercent)}`}>
                          <span className={props.getPercentClass(dayPercent)}>
                            {props.formatMetricPercent(dayPercent)}
                          </span>
                          <div className={styles.progress}>
                            <span style={{ width: `${Math.min(Math.max(dayPercent, 0), 130)}%` }} />
                          </div>
                        </td>
                        <td className={`${styles.metricCell} ${props.getThieuBgClass(Number(row.thieu || 0))}`}>
                          <span className={props.getThieuClass(Number(row.thieu || 0))}>
                            {props.formatMetricNumber(row.thieu)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}

                  <tr className={styles.summaryTotalRow}>
                    <td className={`${styles.stickyFirst} ${styles.nameCell}`}>Tổng</td>
                    <td>{props.formatMetricNumber(props.summaryManagerTotals.kh)}</td>
                    <td>{props.formatMetricNumber(props.summaryManagerTotals.th)}</td>
                    <td className={`${styles.metricCell} ${props.getPercentBgClass(props.managerSummaryTotalPercent)}`}>
                      <span className={props.getPercentClass(props.managerSummaryTotalPercent)}>
                        {props.formatMetricPercent(props.managerSummaryTotalPercent)}
                      </span>
                      <div className={styles.progress}>
                        <span style={{ width: `${Math.min(Math.max(props.managerSummaryTotalPercent, 0), 130)}%` }} />
                      </div>
                    </td>
                    <td className={`${styles.metricCell} ${props.getPercentBgClass(props.managerSummaryDayCompletionPercent)}`}>
                      <span className={props.getPercentClass(props.managerSummaryDayCompletionPercent)}>
                        {props.formatMetricPercent(props.managerSummaryDayCompletionPercent)}
                      </span>
                      <div className={styles.progress}>
                        <span
                          style={{
                            width: `${Math.min(Math.max(props.managerSummaryDayCompletionPercent, 0), 130)}%`,
                          }}
                        />
                      </div>
                    </td>
                    <td className={`${styles.metricCell} ${props.getThieuBgClass(props.summaryManagerTotals.thieu)}`}>
                      <span className={props.getThieuClass(props.summaryManagerTotals.thieu)}>
                        {props.formatMetricNumber(props.summaryManagerTotals.thieu)}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className={styles.mobileCards}>
                <div className={`glass-panel ${styles.mobileCard} ${styles.summaryTotalMobileCard}`}>
                  <div className={styles.mobileHeader}>
                    <div className={styles.mobileTitle}>Tổng</div>
                    <span
                      className={`${props.surfaceBadgeClass} ${styles.statusBadge} ${props.getPercentBgClass(
                        props.managerSummaryTotalPercent
                      )}`}
                    >
                      {props.getStatusLabel(props.managerSummaryTotalPercent)}
                    </span>
                  </div>
                  <div className={styles.mobileSummaryRows}>
                    <div className={styles.mobileSummaryLine}>
                      <span className={`${props.surfaceChipClass} ${styles.chip}`}>
                        KH: {props.formatMetricNumber(props.summaryManagerTotals.kh)}
                      </span>
                      <span className={`${props.surfaceChipClass} ${styles.chip}`}>
                        TH: {props.formatMetricNumber(props.summaryManagerTotals.th)}
                      </span>
                    </div>
                    <div className={styles.mobileSummaryLine}>
                      <span
                        className={`${props.surfaceChipClass} ${styles.chip} ${props.getPercentClass(
                          props.managerSummaryTotalPercent
                        )}`}
                      >
                        %: {props.formatMetricPercent(props.managerSummaryTotalPercent)}
                      </span>
                      <span
                        className={`${props.surfaceChipClass} ${styles.chip} ${props.getThieuClass(
                          props.summaryManagerTotals.thieu
                        )}`}
                      >
                        {detailGapLabel}: {props.formatMetricNumber(props.summaryManagerTotals.thieu)}
                      </span>
                    </div>
                    <div className={styles.mobileSummaryLine}>
                      <span
                        className={`${props.surfaceChipClass} ${styles.chip} ${props.getPercentClass(
                          props.managerSummaryDayCompletionPercent
                        )}`}
                      >
                        % HT ngày: {props.formatMetricPercent(props.managerSummaryDayCompletionPercent)}
                      </span>
                    </div>
                  </div>
                  <div className={styles.progress}>
                    <span
                      style={{ width: `${Math.min(Math.max(props.managerSummaryTotalPercent, 0), 130)}%` }}
                    />
                  </div>
                </div>
                {props.managerSummaryPagedMobileRows.map((row) => {
                  const percent = Number(row.percent || 0);
                  const dayPercent = props.isCuocManagerSummaryIndicator
                    ? props.computeCuocN1N3CompletionPercent(Number(row.th || 0), {
                        maxPercent: props.summaryManagerMeta.maxPercent,
                      })
                    : props.computeKpiDayCompletionPercent(
                        Number(row.kh || 0),
                        Number(row.th || 0),
                        props.summaryMonthProgressPercent,
                        {
                          isNegative: props.summaryManagerMeta.isNegativeGroup,
                          maxPercent: props.summaryManagerMeta.maxPercent,
                        }
                      );

                  return (
                    <div key={`mgr-m-${row.managerUser}`} className={`glass-panel ${styles.mobileCard}`}>
                      <div className={styles.mobileHeader}>
                        <div className={styles.mobileTitle}>{row.managerUser}</div>
                        <span
                          className={`${props.surfaceBadgeClass} ${styles.statusBadge} ${props.getPercentBgClass(
                            percent
                          )}`}
                        >
                          {props.getStatusLabel(percent)}
                        </span>
                      </div>
                      {(row.managerName || row.jobTitle) && (
                        <div className={styles.summaryManagerMeta}>
                          {[row.managerName, row.jobTitle].filter(Boolean).join(" • ")}
                        </div>
                      )}
                      <div className={styles.mobileSummaryRows}>
                        <div className={styles.mobileSummaryLine}>
                          <span className={`${props.surfaceChipClass} ${styles.chip}`}>
                            KH: {props.formatMetricNumber(row.kh)}
                          </span>
                          <span className={`${props.surfaceChipClass} ${styles.chip}`}>
                            TH: {props.formatMetricNumber(row.th)}
                          </span>
                        </div>
                        <div className={styles.mobileSummaryLine}>
                          <span
                            className={`${props.surfaceChipClass} ${styles.chip} ${props.getPercentClass(percent)}`}
                          >
                            %: {props.formatMetricPercent(percent)}
                          </span>
                          <span
                            className={`${props.surfaceChipClass} ${styles.chip} ${props.getPercentClass(dayPercent)}`}
                          >
                            % HT ngày: {props.formatMetricPercent(dayPercent)}
                          </span>
                        </div>
                        <div className={styles.mobileSummaryLine}>
                          <span
                            className={`${props.surfaceChipClass} ${styles.chip} ${props.getThieuClass(
                              Number(row.thieu || 0)
                            )}`}
                          >
                            {detailGapLabel}: {props.formatMetricNumber(row.thieu)}
                          </span>
                        </div>
                      </div>
                      <div className={styles.progress}>
                        <span style={{ width: `${Math.min(Math.max(percent, 0), 130)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            // Row-based layout: each manager is a full-width row with metrics table
            <div className={styles.allViewRows}>
              {visibleAllRows.length === 0 && (
                <div className={styles.managerFilterEmpty}>
                  Không có chỉ tiêu chưa đạt trong phạm vi đang xem.
                </div>
              )}
              {pagedAllRows.map((mgr) => (
                <div key={mgr.managerUser} className={`glass-panel ${styles.allViewManagerRow}`}>
                  <div className={styles.allViewManagerHeader}>
                    <span className={styles.allViewManagerAvatar} aria-hidden="true">
                      <UserRound size={22} />
                    </span>
                    <div>
                      <div className={styles.allViewManagerName}>{mgr.managerUser}</div>
                      {(mgr.managerName || mgr.jobTitle) && (
                        <div className={styles.summaryManagerMeta}>
                          {[mgr.managerName, mgr.jobTitle].filter(Boolean).join(" • ")}
                        </div>
                      )}
                    </div>
                    <div className={styles.managerRowCounts}>
                      <span className={`${props.surfaceChipClass} ${styles.managerCountIncomplete}`}>
                        Chưa đạt: {mgr.metrics.filter((metric) => Number(metric.percent || 0) < 100).length}
                      </span>
                      <span className={props.surfaceChipClass}>
                        Đã đạt: {mgr.metrics.filter((metric) => Number(metric.percent || 0) >= 100).length}
                      </span>
                    </div>
                  </div>
                  <div className={styles.allViewMetricsWrap}>
                    <table className={styles.allViewMetricsTable}>
                      <thead>
                        <tr>
                          <th>Chỉ tiêu</th>
                          <th>KH</th>
                          <th>TH</th>
                          <th>%</th>
                          <th>% HT ngày</th>
                          <th>Khoảng cách</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortManagerKpiMetricsByCompletion(mgr.metrics)
                          .map((metric) => {
                            const metricDayPercent = isCuocN1N3MetricKey(metric.metricCode || metric.name)
                              ? props.computeCuocN1N3CompletionPercent(Number(metric.th || 0), {
                                  maxPercent: metric.maxPercent,
                                })
                              : props.computeKpiDayCompletionPercent(
                                  Number(metric.kh || 0),
                                  Number(metric.th || 0),
                                  props.summaryMonthProgressPercent,
                                  {
                                    isNegative: metric.isNegative,
                                    maxPercent: metric.maxPercent,
                                  }
                                );
                            const metricGapLabel = metric.isNegative ? "Vượt ngưỡng" : "Còn thiếu";
                            return (
                              <tr key={metric.name}>
                                <td className={styles.allViewMetricName}>{metric.name}</td>
                                <td>{props.formatMetricNumber(metric.kh)}</td>
                                <td>{props.formatMetricNumber(metric.th)}</td>
                                <td className={`${styles.metricCell} ${props.getPercentBgClass(metric.percent)}`}>
                                  <span className={props.getPercentClass(metric.percent)}>
                                    {props.formatMetricPercent(metric.percent)}
                                  </span>
                                  <div className={styles.progress}>
                                    <span style={{ width: `${Math.min(Math.max(metric.percent, 0), 130)}%` }} />
                                  </div>
                                </td>
                                <td className={`${styles.metricCell} ${props.getPercentBgClass(metricDayPercent)}`}>
                                  <span className={props.getPercentClass(metricDayPercent)}>
                                    {props.formatMetricPercent(metricDayPercent)}
                                  </span>
                                  <div className={styles.progress}>
                                    <span style={{ width: `${Math.min(Math.max(metricDayPercent, 0), 130)}%` }} />
                                  </div>
                                </td>
                                <td className={`${styles.metricCell} ${props.getThieuBgClass(metric.thieu)}`}>
                                  <span className={props.getThieuClass(metric.thieu)}>
                                    <span className={styles.managerGapLabel}>{metricGapLabel}</span>
                                    {props.formatMetricNumber(metric.thieu)}
                                  </span>
                                  {metric.thieu > 0 && (
                                    <span style={{ color: "#ef4444", marginLeft: 4, fontSize: "0.75rem" }}>⚠️</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination controls */}
          {((isAllView ? totalAllPages : props.managerSummaryTotalPages) > 1) && (
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
              <button
                className={props.surfacePaginationBtnClass}
                disabled={props.managerSummaryPage <= 1}
                onClick={() => props.onPageChange((current) => Math.max(1, current - 1))}
              >
                Trước
              </button>
              <span className={styles.refreshHint}>
                Trang {props.managerSummaryPage}/{isAllView ? totalAllPages : props.managerSummaryTotalPages}
              </span>
              <button
                className={props.surfacePaginationBtnClass}
                disabled={props.managerSummaryPage >= (isAllView ? totalAllPages : props.managerSummaryTotalPages)}
                onClick={() =>
                  props.onPageChange((current) =>
                    Math.min(isAllView ? totalAllPages : props.managerSummaryTotalPages, current + 1)
                  )
                }
              >
                Sau
              </button>
            </div>
          )}
        </div>
      </PrepaidPanelState>
    </div>
  );
}
