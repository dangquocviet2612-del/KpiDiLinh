import type { CSSProperties, ChangeEvent } from "react";
import { Loader2, Upload } from "lucide-react";
import styles from "./kpi.module.css";
import PrepaidPanelState from "./PrepaidPanelState";

type KpiRow = {
  kpiCode: string;
  displayName: string;
  khThang: number | null;
  thNgay: number | null;
  thLuyKe: number | null;
  completionPercent: number;
  baseScore: number;
  maxScore: number;
  achievedScore: number;
};

type CtvOption = {
  id: string | number;
  username: string;
};

type PersonalKpiPanelCleanProps = {
  canAdmin: boolean;
  canSelectCtv: boolean;
  ctvOptions: CtvOption[];
  selectedCtv: string;
  reportDate: string;
  importing: boolean;
  refreshing: boolean;
  loading: boolean;
  errorMessage: string | null;
  reportRows: KpiRow[];
  mobileSortedRows: KpiRow[];
  scorePercent: number;
  totals: {
    totalBaseScore: number;
    totalAchievedScore: number;
  };
  surfaceActionBtnClass: string;
  surfacePrimaryBtnClass: string;
  surfacePrimaryBadgeClass: string;
  surfaceBadgeClass: string;
  surfaceChipClass: string;
  getPercentBgClass: (percent: number) => string;
  getPercentClass: (percent: number) => string;
  getStatusLabel: (percent: number) => string;
  onSelectedCtvChange: (value: string) => void;
  onReportDateChange: (value: string) => void;
  onRefresh: () => void;
  onImport: (event: ChangeEvent<HTMLInputElement>) => void;
};

const getProgressColor = (percent: number) => {
  if (percent >= 100) return "#10b981";
  if (percent >= 70) return "#eab308";
  return "#ef4444";
};

const getProgressStyle = (percent: number): CSSProperties => {
  return {
    width: `${Math.min(Math.max(percent, 0), 130)}%`,
    ["--progress-color"]: getProgressColor(percent),
  } as CSSProperties;
};

export default function PersonalKpiPanelClean(props: PersonalKpiPanelCleanProps) {
  const getScoreClassName = (score: number) =>
    score === 0 ? `${styles.scoreCell} ${styles.personalKpiNeutralScore}` : styles.scoreCell;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className="ui-panel-heading">
          <h1 className={`${styles.title} ui-panel-title`}>Bảng KPI</h1>
          <p className={`${styles.subtitle} ui-panel-subtitle`}>CTV chỉ xem KPI của mình.</p>
        </div>
        <div className={`${styles.totalCard} ${styles.personalKpiTotalCard}`}>
          <div className={styles.totalLabelRow}>
            <div className={styles.totalLabel}>Tổng điểm KPI</div>
            <span className={`${props.surfacePrimaryBadgeClass} ${styles.totalPercentBadge}`}>
              {props.scorePercent}%
            </span>
          </div>
          <div className={styles.totalValueRow}>
            <div className={styles.totalValue}>{props.totals.totalAchievedScore.toFixed(2)}</div>
            <div className={styles.totalSub}>/ {props.totals.totalBaseScore.toFixed(0)} điểm chuẩn</div>
          </div>
          <div className={`${styles.totalProgress} ${styles.personalKpiTotalProgress}`}>
            <span style={getProgressStyle(props.scorePercent)} />
          </div>
        </div>
      </div>

      <div className={`glass-panel ${styles.toolbar}`}>
        {props.canSelectCtv && (
          <select
            className="input-base"
            value={props.selectedCtv}
            onChange={(event) => props.onSelectedCtvChange(event.target.value)}
          >
            {props.ctvOptions.map((user) => (
              <option key={user.id} value={user.username}>
                {user.username}
              </option>
            ))}
          </select>
        )}
        <input
          type="date"
          className="input-base"
          value={props.reportDate}
          onChange={(event) => props.onReportDateChange(event.target.value)}
        />
        <button className={props.surfaceActionBtnClass} onClick={props.onRefresh}>
          Làm mới dữ liệu KPI
        </button>
        {props.canAdmin && (
          <label className={props.surfacePrimaryBtnClass}>
            {props.importing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            Tải lên file GBOC
            <input type="file" accept=".xlsx" hidden onChange={props.onImport} disabled={props.importing} />
          </label>
        )}
        {props.refreshing && <span className={styles.refreshHint}>Đang làm mới dữ liệu...</span>}
      </div>

      <PrepaidPanelState
        loading={props.loading}
        errorMessage={props.errorMessage}
        isEmpty={props.reportRows.length === 0}
        emptyTitle="Chưa có dữ liệu KPI"
        emptyDescription="Thử đổi ngày báo cáo hoặc tải lên file GBOC mới để cập nhật kết quả."
        onRetry={props.onRefresh}
        actionBtnClass={props.surfaceActionBtnClass}
        skeletonStats={1}
        skeletonRows={5}
      >
        <div className={styles.tableWrap}>
          <table className={`${styles.table} ${styles.personalKpiTable}`}>
            <colgroup>
              <col style={{ width: "32%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "18%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "10%" }} />
            </colgroup>
            <thead>
              <tr>
                <th>Chỉ tiêu</th>
                <th>KH</th>
                <th>TH</th>
                <th>% HT</th>
                <th>Điểm chuẩn</th>
                <th>Điểm tối đa</th>
                <th>Điểm đạt</th>
              </tr>
            </thead>
            <tbody>
              {props.reportRows.map((row) => {
                const percent = Number(row.completionPercent || 0);
                const achievedScore = Number(row.achievedScore || 0);
                return (
                  <tr key={row.kpiCode}>
                    <td className={`${styles.nameCell} ${styles.personalKpiTitleCell}`}>
                      {row.displayName || row.kpiCode}
                    </td>
                    <td className={styles.numberCell}>
                      <span className={styles.maxBadge}>{Number(row.khThang ?? 0).toFixed(2)}</span>
                    </td>
                    <td className={styles.numberCell}>
                      <span className={styles.maxBadge}>{Number(row.thLuyKe ?? row.thNgay ?? 0).toFixed(2)}</span>
                    </td>
                    <td className={`${styles.metricCell} ${props.getPercentBgClass(percent)}`}>
                      <span className={props.getPercentClass(percent)}>{percent.toFixed(1)}%</span>
                      <div className={`${styles.progress} ${styles.personalKpiProgress}`}>
                        <span style={getProgressStyle(percent)} />
                      </div>
                    </td>
                    <td className={styles.numberCell}>
                      <span className={styles.maxBadge}>{Number(row.baseScore || 0).toFixed(2)}</span>
                    </td>
                    <td className={styles.numberCell}>
                      <span className={styles.maxBadge}>{Number(row.maxScore || 0).toFixed(2)}</span>
                    </td>
                    <td className={`${getScoreClassName(achievedScore)} ${styles.numberCell}`}>
                      {achievedScore.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className={styles.mobileCards}>
            {props.mobileSortedRows.map((row) => {
              const percent = Number(row.completionPercent || 0);
              const maxScore = Number(row.maxScore || 0);
              const achieved = Number(row.achievedScore || 0);
              return (
                <div key={`m-${row.kpiCode}`} className={`glass-panel ${styles.mobileCard}`}>
                  <div className={styles.mobileHeader}>
                    <div className={styles.mobileTitle}>{row.displayName || row.kpiCode}</div>
                    <span
                      className={`${props.surfaceBadgeClass} ${styles.statusBadge} ${props.getPercentBgClass(percent)}`}
                    >
                      {props.getStatusLabel(percent)}
                    </span>
                  </div>
                  <div className={styles.mobileScoreLine}>
                    <strong className={achieved === 0 ? styles.personalKpiNeutralScore : undefined}>{achieved.toFixed(2)}</strong>
                    <span>/ {maxScore.toFixed(2)} điểm</span>
                  </div>
                  <div className={styles.mobileChips}>
                    <span className={`${props.surfaceChipClass} ${styles.chip} ${styles.personalKpiChip}`}>
                      KH: {row.khThang ?? 0}
                    </span>
                    <span className={`${props.surfaceChipClass} ${styles.chip} ${styles.personalKpiChip}`}>
                      TH: {row.thLuyKe ?? row.thNgay ?? 0}
                    </span>
                    <span
                      className={`${props.surfaceChipClass} ${styles.chip} ${styles.personalKpiChip} ${props.getPercentClass(percent)}`}
                    >
                      %: {percent.toFixed(1)}%
                    </span>
                    <span className={`${props.surfaceChipClass} ${styles.chip} ${styles.personalKpiChip}`}>
                      Điểm chuẩn: {Number(row.baseScore || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className={`${styles.progress} ${styles.personalKpiProgress}`}>
                    <span style={getProgressStyle(percent)} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </PrepaidPanelState>

      <div className={styles.mobileBottomSummarySpacer} aria-hidden="true" />
      <div className={styles.mobileBottomSummaryDock}>
        <div className={`${styles.mobileBottomSummaryCard} ${styles.personalKpiMobileBottomSummaryCard}`}>
          <div className={styles.mobileBottomSummaryHead}>
            <span className={styles.mobileBottomSummaryLabel}>Tổng điểm KPI</span>
            <span className={`${props.surfacePrimaryBadgeClass} ${styles.mobileBottomSummaryBadge}`}>
              {props.scorePercent}%
            </span>
          </div>
          <div className={styles.mobileBottomSummaryMain}>
            <strong>{props.totals.totalAchievedScore.toFixed(2)}</strong>
            <span>/ {props.totals.totalBaseScore.toFixed(0)} điểm chuẩn</span>
          </div>
        </div>
      </div>
    </div>
  );
}
