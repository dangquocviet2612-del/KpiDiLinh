import { ListFilter } from "lucide-react";
import styles from "./kpi.module.css";
import PrepaidPanelState from "./PrepaidPanelState";

type SummaryRow = {
  ctvUser: string;
  kh: number;
  th: number;
  percent: number;
  thieu: number;
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

type SummaryKpiPanelCleanProps = {
  canAdmin: boolean;
  reportDate: string;
  managerFilter: string;
  managerOptions: string[];
  selectedIndicator: string;
  indicators: string[];
  summaryLoading: boolean;
  summaryRefreshing: boolean;
  errorMessage: string | null;
  summaryRows: SummaryRow[];
  summaryTotals: SummaryTotals;
  summaryTotalPercent: number;
  summaryDayCompletionPercent: number;
  summaryPagedRows: SummaryRow[];
  summaryPagedMobileRows: SummaryRow[];
  summaryPage: number;
  summaryTotalPages: number;
  summaryOnlyIncomplete: boolean;
  summaryVisibleCount: number;
  summaryMeta: SummaryMeta;
  summaryMonthProgressPercent: number;
  isCuocSummaryIndicator: boolean;
  surfaceActionBtnClass: string;
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
  onReportDateChange: (value: string) => void;
  onManagerFilterChange: (value: string) => void;
  onRefresh: () => void;
  onIndicatorChange: (value: string) => void;
  onSummaryPageChange: (value: number | ((current: number) => number)) => void;
  onOnlyIncompleteChange: (value: boolean) => void;
};

export default function SummaryKpiPanelClean(props: SummaryKpiPanelCleanProps) {
  const detailGapLabel = props.summaryMeta.isNegativeGroup ? "Vượt ngưỡng" : "Còn thiếu";
  const incompleteCount = props.summaryRows.filter((row) => Number(row.percent || 0) < 100).length;
  const achievedCount = props.summaryRows.length - incompleteCount;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className="ui-panel-heading">
          <h1 className={`${styles.title} ui-panel-title`}>Tổng hợp KPI</h1>
          <p className={`${styles.subtitle} ui-panel-subtitle`}>
            Chọn chỉ tiêu để xem kết quả từng nhân viên
          </p>
        </div>
        <div className={styles.summaryHeaderActions}>
          <button className={props.surfaceActionBtnClass} onClick={props.onBack}>
            Quay lại KPI cá nhân
          </button>
        </div>
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
          Làm mới dữ liệu
        </button>
        <label className={styles.toolbarField}>
          <span className={styles.toolbarFieldLabel}>Chỉ tiêu</span>
          <select
            className="input-base"
            value={props.selectedIndicator}
            onChange={(event) => props.onIndicatorChange(event.target.value)}
          >
            {props.indicators.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={`${props.surfaceActionBtnClass} ${props.summaryOnlyIncomplete ? styles.managerFilterActive : ""}`}
          aria-pressed={props.summaryOnlyIncomplete}
          onClick={() => props.onOnlyIncompleteChange(!props.summaryOnlyIncomplete)}
        >
          <ListFilter size={16} />
          Chỉ hiện chưa đạt
        </button>
        <div className={styles.managerSummaryCounts} aria-label="Thống kê trạng thái KPI">
          <span className={`${props.surfaceChipClass} ${styles.managerCountIncomplete}`}>
            Chưa đạt: {incompleteCount}
          </span>
          <span className={props.surfaceChipClass}>Đã đạt: {achievedCount}</span>
        </div>
        {props.summaryRefreshing && <span className={styles.refreshHint}>Đang làm mới dữ liệu...</span>}
      </div>

      <PrepaidPanelState
        loading={props.summaryLoading}
        errorMessage={props.errorMessage}
        isEmpty={props.summaryRows.length === 0}
        emptyTitle="Chưa có dữ liệu tổng hợp"
        emptyDescription="Thử đổi ngày báo cáo, bộ lọc quản lý hoặc chỉ tiêu để xem kết quả."
        onRetry={props.onRefresh}
        actionBtnClass={props.surfaceActionBtnClass}
        skeletonStats={5}
        skeletonRows={6}
      >
        <div className={styles.tableWrap}>
          <div className={`glass-panel ${styles.kpiCards} ${styles.summaryStatsGrid}`}>
              <div className={`${styles.kpiStat} ${styles.summaryStatCard}`}>
                <span>Tổng KH</span>
                <strong>{props.formatMetricNumber(props.summaryTotals.kh)}</strong>
              </div>
              <div className={`${styles.kpiStat} ${styles.summaryStatCard}`}>
                <span>Tổng TH</span>
                <strong>{props.formatMetricNumber(props.summaryTotals.th)}</strong>
              </div>
              <div className={`${styles.kpiStat} ${styles.summaryStatCard}`}>
                <span>Hoàn thành</span>
                <strong className={props.getPercentClass(props.summaryTotalPercent)}>
                  {props.formatMetricPercent(props.summaryTotalPercent)}
                </strong>
              </div>
              <div className={`${styles.kpiStat} ${styles.summaryStatCard}`}>
                <span>{detailGapLabel}</span>
                <strong className={props.getThieuClass(props.summaryTotals.thieu)}>
                  {props.formatMetricNumber(props.summaryTotals.thieu)}
                </strong>
              </div>
              <div className={`${styles.kpiStat} ${styles.summaryStatCard}`}>
                <span>% HT ngày</span>
                <strong className={props.getPercentClass(props.summaryDayCompletionPercent)}>
                  {props.formatMetricPercent(props.summaryDayCompletionPercent)}
                </strong>
              </div>
            </div>

          {props.summaryOnlyIncomplete && props.summaryVisibleCount === 0 && (
            <div className={styles.managerFilterEmpty}>
              Tất cả nhân viên trong phạm vi đang xem đã đạt chỉ tiêu này.
            </div>
          )}

          <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.stickyFirst}>Nhân viên</th>
                  <th>KH</th>
                  <th>TH</th>
                  <th>%</th>
                  <th>% HT ngày</th>
                  <th>{detailGapLabel}</th>
                </tr>
              </thead>
              <tbody>
                {props.summaryPagedRows.map((row) => {
                  const percent = Number(row.percent || 0);
                  const dayPercent = props.isCuocSummaryIndicator
                    ? props.computeCuocN1N3CompletionPercent(Number(row.th || 0), {
                        maxPercent: props.summaryMeta.maxPercent,
                      })
                    : props.computeKpiDayCompletionPercent(
                        Number(row.kh || 0),
                        Number(row.th || 0),
                        props.summaryMonthProgressPercent,
                        {
                          isNegative: props.summaryMeta.isNegativeGroup,
                          maxPercent: props.summaryMeta.maxPercent,
                        }
                      );

                  return (
                    <tr key={row.ctvUser}>
                      <td className={`${styles.stickyFirst} ${styles.nameCell}`}>{row.ctvUser}</td>
                      <td>{props.formatMetricNumber(row.kh)}</td>
                      <td>{props.formatMetricNumber(row.th)}</td>
                      <td className={`${styles.metricCell} ${props.getPercentBgClass(percent)}`}>
                        <span className={props.getPercentClass(percent)}>{props.formatMetricPercent(percent)}</span>
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
                  <td>{props.formatMetricNumber(props.summaryTotals.kh)}</td>
                  <td>{props.formatMetricNumber(props.summaryTotals.th)}</td>
                  <td className={`${styles.metricCell} ${props.getPercentBgClass(props.summaryTotalPercent)}`}>
                    <span className={props.getPercentClass(props.summaryTotalPercent)}>
                      {props.formatMetricPercent(props.summaryTotalPercent)}
                    </span>
                    <div className={styles.progress}>
                      <span style={{ width: `${Math.min(Math.max(props.summaryTotalPercent, 0), 130)}%` }} />
                    </div>
                  </td>
                  <td className={`${styles.metricCell} ${props.getPercentBgClass(props.summaryDayCompletionPercent)}`}>
                    <span className={props.getPercentClass(props.summaryDayCompletionPercent)}>
                      {props.formatMetricPercent(props.summaryDayCompletionPercent)}
                    </span>
                    <div className={styles.progress}>
                      <span
                        style={{ width: `${Math.min(Math.max(props.summaryDayCompletionPercent, 0), 130)}%` }}
                      />
                    </div>
                  </td>
                  <td className={`${styles.metricCell} ${props.getThieuBgClass(props.summaryTotals.thieu)}`}>
                    <span className={props.getThieuClass(props.summaryTotals.thieu)}>
                      {props.formatMetricNumber(props.summaryTotals.thieu)}
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
                      props.summaryTotalPercent
                    )}`}
                  >
                    {props.getStatusLabel(props.summaryTotalPercent)}
                  </span>
                </div>
                <div className={styles.mobileSummaryRows}>
                  <div className={styles.mobileSummaryLine}>
                    <span className={`${props.surfaceChipClass} ${styles.chip}`}>
                      KH: {props.formatMetricNumber(props.summaryTotals.kh)}
                    </span>
                    <span className={`${props.surfaceChipClass} ${styles.chip}`}>
                      TH: {props.formatMetricNumber(props.summaryTotals.th)}
                    </span>
                  </div>
                  <div className={styles.mobileSummaryLine}>
                    <span
                      className={`${props.surfaceChipClass} ${styles.chip} ${props.getPercentClass(
                        props.summaryTotalPercent
                      )}`}
                    >
                      %: {props.formatMetricPercent(props.summaryTotalPercent)}
                    </span>
                    <span
                      className={`${props.surfaceChipClass} ${styles.chip} ${props.getThieuClass(
                        props.summaryTotals.thieu
                      )}`}
                    >
                      {detailGapLabel}: {props.formatMetricNumber(props.summaryTotals.thieu)}
                    </span>
                  </div>
                  <div className={styles.mobileSummaryLine}>
                    <span
                      className={`${props.surfaceChipClass} ${styles.chip} ${props.getPercentClass(
                        props.summaryDayCompletionPercent
                      )}`}
                    >
                      % HT ngày: {props.formatMetricPercent(props.summaryDayCompletionPercent)}
                    </span>
                  </div>
                </div>
                <div className={styles.progress}>
                  <span style={{ width: `${Math.min(Math.max(props.summaryTotalPercent, 0), 130)}%` }} />
                </div>
              </div>
              {props.summaryPagedMobileRows.map((row) => {
                const percent = Number(row.percent || 0);
                const dayPercent = props.isCuocSummaryIndicator
                  ? props.computeCuocN1N3CompletionPercent(Number(row.th || 0), {
                      maxPercent: props.summaryMeta.maxPercent,
                    })
                  : props.computeKpiDayCompletionPercent(
                      Number(row.kh || 0),
                      Number(row.th || 0),
                      props.summaryMonthProgressPercent,
                      {
                        isNegative: props.summaryMeta.isNegativeGroup,
                        maxPercent: props.summaryMeta.maxPercent,
                      }
                    );

                return (
                  <div key={`m-${row.ctvUser}`} className={`glass-panel ${styles.mobileCard}`}>
                    <div className={styles.mobileHeader}>
                      <div className={styles.mobileTitle}>{row.ctvUser}</div>
                      <span
                        className={`${props.surfaceBadgeClass} ${styles.statusBadge} ${props.getPercentBgClass(
                          percent
                        )}`}
                      >
                        {props.getStatusLabel(percent)}
                      </span>
                    </div>
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

          {props.summaryTotalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
              <button
                className={props.surfacePaginationBtnClass}
                disabled={props.summaryPage <= 1}
                onClick={() => props.onSummaryPageChange((current) => Math.max(1, current - 1))}
              >
                Trước
              </button>
              <span className={styles.refreshHint}>
                Trang {props.summaryPage}/{props.summaryTotalPages}
              </span>
              <button
                className={props.surfacePaginationBtnClass}
                disabled={props.summaryPage >= props.summaryTotalPages}
                onClick={() =>
                  props.onSummaryPageChange((current) =>
                    Math.min(props.summaryTotalPages, current + 1)
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
