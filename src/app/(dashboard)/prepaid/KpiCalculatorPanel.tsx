import { useState, type CSSProperties } from "react";
import { ChevronDown, Minus, Plus, RotateCcw } from "lucide-react";
import PrepaidPanelState from "./PrepaidPanelState";
import styles from "./kpi.module.css";
import { getKpiCalculatorTargetValue, type KpiCalculatorChangeSummaryItem } from "@/lib/kpi-calculator";
import type { KpiCalculatorRow } from "@/lib/kpi-report-calculation";

type CtvOption = {
  id: string | number;
  username: string;
};

type KpiCalculatorPanelProps = {
  canSelectCtv: boolean;
  ctvOptions: CtvOption[];
  selectedCtv: string;
  reportDate: string;
  loading: boolean;
  refreshing: boolean;
  errorMessage: string | null;
  rows: KpiCalculatorRow[];
  changeSummaryRows: KpiCalculatorChangeSummaryItem[];
  draftValues: Record<string, string>;
  dirtyCount: number;
  hasDraftEdits?: boolean;
  totals: {
    totalBaseScore: number;
    totalCurrentScore: number;
    totalSimulatedScore: number;
    totalDeltaScore: number;
    missingToHundred: number;
    exceededOverHundred: number;
    scorePercentCurrent: number;
    scorePercentSimulated: number;
  };
  surfaceActionBtnClass: string;
  surfacePrimaryBtnClass: string;
  surfaceBadgeClass: string;
  surfaceChipClass: string;
  getPercentBgClass: (percent: number) => string;
  getPercentClass: (percent: number) => string;
  getThieuBgClass: (value: number) => string;
  getThieuClass: (value: number) => string;
  onBack: () => void;
  onSelectedCtvChange: (value: string) => void;
  onReportDateChange: (value: string) => void;
  onRefresh: () => void;
  onReset: () => void;
  onDraftValueChange: (kpiCode: string, value: string) => void;
  onStepDraftValue: (kpiCode: string, delta: number) => void;
  onSetTargetValue: (kpiCode: string) => void;
};

function formatScore(value: number) {
  return Number(value || 0).toLocaleString("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatTarget(value: number) {
  return Number(value || 0).toLocaleString("vi-VN", { maximumFractionDigits: 2 });
}

function formatSignedNumber(value: number) {
  const formatted = formatTarget(Math.abs(value));
  return `${value > 0 ? "+" : value < 0 ? "-" : ""}${formatted}`;
}

function formatSignedScore(value: number) {
  const formatted = formatScore(Math.abs(value));
  return `${value > 0 ? "+" : value < 0 ? "-" : ""}${formatted}`;
}

function getDeltaTextClass(value: number) {
  if (value > 0) {
    return styles.good;
  }
  if (value < 0) {
    return styles.bad;
  }
  return styles.neutral;
}

function getDeltaBgClass(value: number) {
  if (value > 0) {
    return styles.goodBg;
  }
  if (value < 0) {
    return styles.badBg;
  }
  return styles.neutralBg;
}

function getProgressColor(percent: number) {
  if (percent >= 100) {
    return "#10b981";
  }
  if (percent >= 80) {
    return "#f59e0b";
  }
  return "#ef4444";
}

function getProgressStyle(percent: number): CSSProperties {
  return {
    width: `${Math.min(Math.max(percent, 0), 130)}%`,
    "--progress-color": getProgressColor(percent),
  } as CSSProperties;
}

export default function KpiCalculatorPanel(props: KpiCalculatorPanelProps) {
  const [isChangeSummaryOpen, setIsChangeSummaryOpen] = useState(false);
  const [showAllChanges, setShowAllChanges] = useState(false);
  const [stepSize, setStepSize] = useState(1);
  const visibleChangeRows = showAllChanges ? props.changeSummaryRows : props.changeSummaryRows.slice(0, 3);
  const hasExceededTarget = props.totals.exceededOverHundred > 0;
  const hasReachedTarget = props.totals.totalBaseScore > 0 && props.totals.missingToHundred === 0;
  const targetStatusLabel = hasExceededTarget
    ? "Vượt chuẩn 100%"
    : hasReachedTarget
      ? "Đã đạt 100%"
      : "Còn thiếu để đạt 100%";
  const targetStatusValue = hasExceededTarget
    ? props.totals.exceededOverHundred
    : props.totals.missingToHundred;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className="ui-panel-heading">
          <h1 className={`${styles.title} ui-panel-title`}>Tính KPI</h1>
          <p className={`${styles.subtitle} ui-panel-subtitle`}>
            Giả lập KPI cá nhân bằng cách chỉnh TH để ước lượng điểm hoàn thành của từng CTV.
          </p>
        </div>
        <div className={styles.summaryHeaderActions}>
          <button className={props.surfaceActionBtnClass} onClick={props.onBack}>
            Quay lại KPI cá nhân
          </button>
        </div>
      </div>

      <div className={`glass-panel ${styles.toolbar} ${styles.calculatorToolbar}`}>
        <div className={styles.calculatorToolbarFields}>
          {props.canSelectCtv && (
            <select
              className="input-base"
              value={props.selectedCtv}
              onChange={(event) => props.onSelectedCtvChange(event.target.value)}
              aria-label="Chọn CTV để tính KPI"
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
            aria-label="Ngày báo cáo tính KPI"
          />
          <label className={styles.calculatorStepSizeField}>
            <span>Bước tăng/giảm</span>
            <select
              className="input-base"
              value={stepSize}
              onChange={(event) => setStepSize(Number(event.target.value))}
              aria-label="Bước tăng giảm"
            >
              <option value="0.1">0,1</option>
              <option value="1">1</option>
              <option value="10">10</option>
            </select>
          </label>
        </div>
        <div className={styles.calculatorToolbarActions}>
          <button className={props.surfaceActionBtnClass} onClick={props.onRefresh}>
            Làm mới từ KPI hiện tại
          </button>
          <button className={props.surfaceActionBtnClass} onClick={props.onReset} disabled={!(props.hasDraftEdits ?? props.dirtyCount > 0)}>
            <RotateCcw size={16} />
            Khôi phục dữ liệu gốc
          </button>
          {props.refreshing && <span className={styles.refreshHint}>Đang làm mới dữ liệu...</span>}
        </div>
      </div>

      <div className={`glass-panel ${styles.kpiCards} ${styles.summaryStatsGrid} ${styles.calculatorSummaryStatsGrid}`}>
        <div className={`${styles.kpiStat} ${styles.summaryStatCard} ${styles.calculatorSummaryStatCard}`}>
          <span>Tổng điểm hiện tại</span>
          <strong>{formatScore(props.totals.totalCurrentScore)}</strong>
          <small className={styles.calculatorStatMeta}>{props.totals.scorePercentCurrent}%</small>
        </div>
        <div className={`${styles.kpiStat} ${styles.summaryStatCard} ${styles.calculatorSummaryStatCard}`}>
          <span>Tổng điểm giả lập</span>
          <strong>{formatScore(props.totals.totalSimulatedScore)}</strong>
          <small className={styles.calculatorStatMeta}>{props.totals.scorePercentSimulated}%</small>
        </div>
        <div className={`${styles.kpiStat} ${styles.summaryStatCard} ${styles.calculatorSummaryStatCard}`}>
          <span>Chênh lệch</span>
          <strong className={getDeltaTextClass(props.totals.totalDeltaScore)}>
            {props.totals.totalDeltaScore > 0 ? "+" : ""}
            {formatScore(props.totals.totalDeltaScore)}
          </strong>
          <small className={styles.calculatorStatMeta}>{props.dirtyCount} chỉ tiêu đang thay đổi</small>
        </div>
        <div className={`${styles.kpiStat} ${styles.summaryStatCard} ${styles.calculatorSummaryStatCard}`}>
          <span>{targetStatusLabel}</span>
          <strong className={hasReachedTarget ? styles.good : props.getThieuClass(targetStatusValue)}>
            {hasExceededTarget ? "+" : ""}
            {formatScore(targetStatusValue)}
          </strong>
          <small className={styles.calculatorStatMeta}>/ {formatScore(props.totals.totalBaseScore)} điểm chuẩn</small>
        </div>
      </div>

      <div className={styles.calculatorMobileStatsRow}>
        <div className={styles.calculatorMobileStatCard}>
          <span>Tổng hiện tại</span>
          <strong>{formatScore(props.totals.totalCurrentScore)}</strong>
          <small>{props.totals.scorePercentCurrent}%</small>
        </div>
        <div className={styles.calculatorMobileStatCard}>
          <span>Tổng giả lập</span>
          <strong>{formatScore(props.totals.totalSimulatedScore)}</strong>
          <small>{props.totals.scorePercentSimulated}%</small>
        </div>
        <div className={styles.calculatorMobileStatCard}>
          <span>Chênh lệch</span>
          <strong className={getDeltaTextClass(props.totals.totalDeltaScore)}>
            {props.totals.totalDeltaScore > 0 ? "+" : ""}
            {formatScore(props.totals.totalDeltaScore)}
          </strong>
          <small>{props.dirtyCount} chỉ tiêu</small>
        </div>
        <div className={styles.calculatorMobileStatCard}>
          <span>{hasExceededTarget ? "Vượt chuẩn" : hasReachedTarget ? "Đã đạt" : "Còn thiếu"}</span>
          <strong className={hasReachedTarget ? styles.good : props.getThieuClass(targetStatusValue)}>
            {hasExceededTarget ? "+" : ""}
            {formatScore(targetStatusValue)}
          </strong>
          <small>{hasExceededTarget ? "trên 100%" : hasReachedTarget ? "đúng mục tiêu" : "để đạt 100%"}</small>
        </div>
      </div>

      {props.changeSummaryRows.length > 0 && (
        <div className={`glass-panel ${styles.calculatorChangeSummary}`}>
          <button
            type="button"
            className={styles.calculatorChangeSummaryTrigger}
            onClick={() => setIsChangeSummaryOpen((current) => !current)}
            aria-expanded={isChangeSummaryOpen}
          >
            <div className={styles.calculatorChangeSummaryHeader}>
              <h2 className={styles.calculatorChangeSummaryTitle}>Tóm tắt thay đổi</h2>
              <div className={styles.calculatorChangeSummaryActions}>
                <span className={`${props.surfaceBadgeClass} ${styles.calculatorChangeSummaryBadge}`}>
                  {props.changeSummaryRows.length} chỉ tiêu
                </span>
                <span className={styles.calculatorChangeSummaryTriggerLabel}>
                  {isChangeSummaryOpen ? "Thu gọn" : "Xem chi tiết"}
                </span>
                <span
                  className={`${styles.calculatorChangeSummaryChevron} ${
                    isChangeSummaryOpen ? styles.calculatorChangeSummaryChevronOpen : ""
                  }`}
                  aria-hidden="true"
                >
                  <ChevronDown size={16} />
                </span>
              </div>
            </div>
          </button>

          {isChangeSummaryOpen && (
            <div
              className={`${styles.calculatorChangeSummaryViewport} ${
                showAllChanges ? styles.calculatorChangeSummaryViewportExpanded : ""
              }`}
            >
              <div className={styles.calculatorChangeSummaryGrid}>
                {visibleChangeRows.map((row) => (
                  <div
                    key={`summary-${row.kpiCode}`}
                    className={`${styles.calculatorChangeSummaryItem} ${
                      row.deltaScore > 0
                        ? styles.calculatorChangeSummaryItemPositive
                        : row.deltaScore < 0
                          ? styles.calculatorChangeSummaryItemNegative
                          : styles.calculatorChangeSummaryItemNeutral
                    }`}
                  >
                    <div className={styles.calculatorChangeSummaryItemHead}>
                      <strong className={styles.calculatorChangeSummaryItemName}>{row.displayName}</strong>
                      <span
                        className={`${styles.calculatorChangeSummaryDeltaBadge} ${getDeltaTextClass(row.deltaScore)}`}
                        title="Điểm nhảy"
                      >
                        {formatSignedScore(row.deltaScore)} điểm
                      </span>
                    </div>
                    <div className={styles.calculatorChangeSummaryItemMeta}>
                      <span className={`${props.surfaceChipClass} ${styles.calculatorChangeSummaryChip}`}>
                        TH hiện tại: {formatTarget(row.thCurrent)}
                      </span>
                    <span className={`${props.surfaceChipClass} ${styles.calculatorChangeSummaryChip}`}>
                      TH giả lập: {formatTarget(row.thSimulated)}
                    </span>
                    <span
                      className={`${props.surfaceChipClass} ${styles.calculatorChangeSummaryChip} ${
                        row.deltaQuantity >= 0
                          ? styles.calculatorChangeSummaryChipPositive
                          : styles.calculatorChangeSummaryChipNegative
                      }`}
                    >
                      {row.deltaQuantity >= 0 ? "Tăng thêm: " : "Giảm bớt: "}
                      {formatSignedNumber(row.deltaQuantity)}
                    </span>
                  </div>
                </div>
              ))}
              </div>

              {props.changeSummaryRows.length > 3 && (
                <div className={styles.calculatorChangeSummaryFooter}>
                  <button
                    type="button"
                    className={`${props.surfaceActionBtnClass} ${styles.calculatorChangeSummaryToggle}`}
                    onClick={() => setShowAllChanges((current) => !current)}
                  >
                    {showAllChanges ? "Thu gọn danh sách" : "Xem tất cả"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <PrepaidPanelState
        loading={props.loading}
        errorMessage={props.errorMessage}
        isEmpty={props.rows.length === 0}
        emptyTitle="Chưa có dữ liệu để tính KPI"
        emptyDescription="Hãy chọn CTV và ngày báo cáo có dữ liệu KPI cá nhân để bắt đầu giả lập."
        onRetry={props.onRefresh}
        actionBtnClass={props.surfaceActionBtnClass}
        skeletonStats={4}
        skeletonRows={6}
      >
        <div className={styles.tableWrap}>
          <table className={`${styles.table} ${styles.calculatorTable}`}>
            <colgroup>
              <col style={{ width: "28%" }} />
              <col style={{ width: "6%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "11%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "9%" }} />
            </colgroup>
            <thead>
              <tr>
                <th>Chỉ tiêu</th>
                <th>KH</th>
                <th>TH hiện tại</th>
                <th>TH giả lập</th>
                <th>% HT giả lập</th>
                <th>Điểm chuẩn</th>
                <th>Điểm tối đa</th>
                <th>Điểm đạt giả lập</th>
                <th>Chênh lệch điểm</th>
              </tr>
            </thead>
            <tbody>
              {props.rows.map((row) => {
                const isChanged = Math.abs(Number(row.deltaScore || 0)) > 0.001;
                const simulatedPercent = Number(row.simulatedCompletionPercent || 0);
                const delta = Number(row.deltaScore || 0);
                const targetValue = getKpiCalculatorTargetValue(row);
                const canSetTarget = targetValue > 0 && simulatedPercent < 100;
                return (
                  <tr key={row.kpiCode} className={isChanged ? styles.calculatorChangedRow : undefined}>
                    <td className={styles.nameCell}>
                      <div className={styles.calculatorNameCell}>
                        <span className={styles.calculatorNameText}>{row.displayName || row.kpiCode}</span>
                        {isChanged && (
                          <span className={`${props.surfaceBadgeClass} ${styles.calculatorChangedBadge}`}>Đã sửa</span>
                        )}
                      </div>
                    </td>
                    <td className={styles.numberCell}>{formatTarget(row.khThang)}</td>
                    <td className={styles.numberCell}>{formatTarget(row.thCurrent)}</td>
                    <td className={styles.numberCell}>
                      <div className={styles.calculatorSimulationControl}>
                        <div className={styles.calculatorStepperWrap}>
                          <button
                            type="button"
                            className={`${props.surfaceActionBtnClass} ${styles.calculatorStepperBtn}`}
                            onClick={() => props.onStepDraftValue(row.kpiCode, -stepSize)}
                            aria-label={`Giảm TH giả lập của ${row.displayName || row.kpiCode}`}
                            title={`Giảm ${formatTarget(stepSize)}`}
                          >
                            <Minus size={14} />
                          </button>
                          <input
                            type="text"
                            inputMode="decimal"
                            className={`${styles.calculatorValueBox} ${styles.calculatorValueInput}`}
                            value={props.draftValues[row.kpiCode] ?? ""}
                            onChange={(event) => props.onDraftValueChange(row.kpiCode, event.target.value)}
                            onFocus={(event) => event.currentTarget.select()}
                            aria-label={`TH giả lập của ${row.displayName || row.kpiCode}`}
                          />
                          <button
                            type="button"
                            className={`${props.surfaceActionBtnClass} ${styles.calculatorStepperBtn}`}
                            onClick={() => props.onStepDraftValue(row.kpiCode, stepSize)}
                            aria-label={`Tăng TH giả lập của ${row.displayName || row.kpiCode}`}
                            title={`Tăng ${formatTarget(stepSize)}`}
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                        {canSetTarget && (
                          <button
                            type="button"
                            className={`${props.surfaceActionBtnClass} ${styles.calculatorTargetBtn}`}
                            onClick={() => props.onSetTargetValue(row.kpiCode)}
                            aria-label={`Đặt ${row.displayName || row.kpiCode} đạt 100%`}
                            title={`Đặt TH giả lập bằng ${formatTarget(targetValue)}`}
                          >
                            Đạt 100%
                          </button>
                        )}
                      </div>
                    </td>
                    <td className={`${styles.metricCell} ${props.getPercentBgClass(simulatedPercent)}`}>
                      <span className={props.getPercentClass(simulatedPercent)}>{simulatedPercent.toFixed(2)}%</span>
                      <div className={`${styles.progress} ${styles.calculatorProgress}`}>
                        <span style={getProgressStyle(simulatedPercent)} />
                      </div>
                    </td>
                    <td className={styles.numberCell}>{formatScore(row.baseScore)}</td>
                    <td className={styles.numberCell}>{formatScore(row.maxScore)}</td>
                    <td className={styles.numberCell}>{formatScore(row.simulatedAchievedScore)}</td>
                    <td className={`${styles.metricCell} ${getDeltaBgClass(delta)}`}>
                      <span className={getDeltaTextClass(delta)}>
                        {delta > 0 ? "+" : ""}
                        {formatScore(delta)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className={styles.mobileCards}>
            {props.rows.map((row) => {
              const simulatedPercent = Number(row.simulatedCompletionPercent || 0);
              const delta = Number(row.deltaScore || 0);
              const isChanged = Math.abs(delta) > 0.001;
              const targetValue = getKpiCalculatorTargetValue(row);
              const canSetTarget = targetValue > 0 && simulatedPercent < 100;
              return (
                <div key={`m-${row.kpiCode}`} className={`glass-panel ${styles.mobileCard}`}>
                  <div className={styles.mobileHeader}>
                    <div className={styles.mobileTitle}>{row.displayName || row.kpiCode}</div>
                    {isChanged && (
                      <span className={`${props.surfaceBadgeClass} ${styles.calculatorChangedBadge}`}>Đã sửa</span>
                    )}
                  </div>
                  <div className={styles.mobileChips}>
                    <span className={`${props.surfaceChipClass} ${styles.chip}`}>KH: {formatTarget(row.khThang)}</span>
                    <span className={`${props.surfaceChipClass} ${styles.chip}`}>TH hiện tại: {formatTarget(row.thCurrent)}</span>
                    <span className={`${props.surfaceChipClass} ${styles.chip}`}>Điểm chuẩn: {formatScore(row.baseScore)}</span>
                    <span className={`${props.surfaceChipClass} ${styles.chip}`}>Điểm tối đa: {formatScore(row.maxScore)}</span>
                  </div>
                  <div className={styles.calculatorMobileStepperBlock}>
                    <div className={styles.calculatorMobileStepperHeader}>
                      <span>TH giả lập</span>
                      {canSetTarget && (
                        <button
                          type="button"
                          className={`${props.surfaceActionBtnClass} ${styles.calculatorTargetBtn}`}
                          onClick={() => props.onSetTargetValue(row.kpiCode)}
                          aria-label={`Đặt ${row.displayName || row.kpiCode} đạt 100%`}
                        >
                          Đạt 100%
                        </button>
                      )}
                    </div>
                    <div className={styles.calculatorMobileStepper}>
                      <button
                        type="button"
                        className={`${props.surfaceActionBtnClass} ${styles.calculatorStepperBtn}`}
                        onClick={() => props.onStepDraftValue(row.kpiCode, -stepSize)}
                        aria-label={`Giảm TH giả lập của ${row.displayName || row.kpiCode}`}
                        title={`Giảm ${formatTarget(stepSize)}`}
                      >
                        <Minus size={14} />
                      </button>
                      <input
                        type="text"
                        inputMode="decimal"
                        className={`${styles.calculatorValueBox} ${styles.calculatorValueInput}`}
                        value={props.draftValues[row.kpiCode] ?? ""}
                        onChange={(event) => props.onDraftValueChange(row.kpiCode, event.target.value)}
                        onFocus={(event) => event.currentTarget.select()}
                        aria-label={`TH giả lập của ${row.displayName || row.kpiCode}`}
                      />
                      <button
                        type="button"
                        className={`${props.surfaceActionBtnClass} ${styles.calculatorStepperBtn}`}
                        onClick={() => props.onStepDraftValue(row.kpiCode, stepSize)}
                        aria-label={`Tăng TH giả lập của ${row.displayName || row.kpiCode}`}
                        title={`Tăng ${formatTarget(stepSize)}`}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                  <div className={styles.mobileSummaryRows}>
                    <div className={styles.mobileSummaryLine}>
                      <span
                        className={`${props.surfaceChipClass} ${styles.chip} ${styles.calculatorMobileInfoChip} ${props.getPercentClass(
                          simulatedPercent,
                        )}`}
                      >
                        % HT: {simulatedPercent.toFixed(2)}%
                      </span>
                      <span className={`${props.surfaceChipClass} ${styles.chip} ${styles.calculatorMobileInfoChip}`}>
                        Điểm đạt: {formatScore(row.simulatedAchievedScore)}
                      </span>
                      <span
                        className={`${props.surfaceChipClass} ${styles.chip} ${styles.calculatorMobileInfoChip} ${getDeltaTextClass(
                          delta,
                        )}`}
                      >
                        Chênh lệch: {delta > 0 ? "+" : ""}
                        {formatScore(delta)}
                      </span>
                    </div>
                  </div>
                  <div className={`${styles.progress} ${styles.calculatorProgress}`}>
                    <span style={getProgressStyle(simulatedPercent)} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </PrepaidPanelState>

      <div className={styles.mobileBottomSummarySpacer} aria-hidden="true" />
      <div className={styles.mobileBottomSummaryDock}>
        <div className={`${styles.mobileBottomSummaryCard} ${styles.calculatorMobileBottomSummaryCard}`}>
          <div className={styles.mobileBottomSummaryHead}>
            <span className={styles.mobileBottomSummaryLabel}>Tổng điểm giả lập</span>
            <span className={`${props.surfaceBadgeClass} ${styles.mobileBottomSummaryBadge}`}>
              {props.totals.scorePercentSimulated}%
            </span>
          </div>
          <div className={styles.mobileBottomSummaryMain}>
            <strong>{formatScore(props.totals.totalSimulatedScore)}</strong>
            <span>/ {formatScore(props.totals.totalBaseScore)} điểm chuẩn</span>
          </div>
          <div className={styles.mobileBottomSummaryChips}>
            <span className={`${props.surfaceChipClass} ${styles.chip} ${styles.calculatorMobileInfoChip}`}>
              Hiện tại: {formatScore(props.totals.totalCurrentScore)}
            </span>
            <span
              className={`${props.surfaceChipClass} ${styles.chip} ${styles.calculatorMobileInfoChip} ${getDeltaTextClass(
                props.totals.totalDeltaScore,
              )}`}
            >
              Chênh lệch: {props.totals.totalDeltaScore > 0 ? "+" : ""}
              {formatScore(props.totals.totalDeltaScore)}
            </span>
            <span
              className={`${props.surfaceChipClass} ${styles.chip} ${styles.calculatorMobileInfoChip} ${
                hasReachedTarget ? styles.good : props.getThieuClass(targetStatusValue)
              }`}
            >
              {hasExceededTarget ? "Vượt: +" : hasReachedTarget ? "Đã đạt: " : "Thiếu: "}
              {formatScore(targetStatusValue)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
