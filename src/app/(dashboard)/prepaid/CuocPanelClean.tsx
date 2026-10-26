"use client";

import type { ChangeEvent } from "react";
import { CalendarDays, ChevronDown, ChevronUp, Loader2, Upload } from "lucide-react";
import PrepaidPanelState from "./PrepaidPanelState";
import styles from "./kpi.module.css";

type CuocRow = {
  ctvUser: string;
  targetAmount: number;
  completionPercent: number;
  missingAmount: number;
};

type CuocPanelCleanProps = {
  canAdmin: boolean;
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
  onBack: () => void;
  onReportDateChange: (value: string) => void;
  onTargetRateChange: (value: number) => void;
  onSaveRate: () => void;
  onRefresh: () => void;
  onImport: (event: ChangeEvent<HTMLInputElement>) => void;
  onToggleMobileFilters: () => void;
  onPageChange: (value: number | ((current: number) => number)) => void;
  isCtv?: boolean;
};

const copy = {
  title: "Ch\u1EC9 ti\u00EAu C\u01B0\u1EDBc",
  subtitle: "Admin xem t\u1EA5t c\u1EA3, Qu\u1EA3n l\u00FD ch\u1EC9 xem nh\u00E2n vi\u00EAn thu\u1ED9c quy\u1EC1n.",
  back: "Quay l\u1EA1i KPI",
  completionRate: "T\u1EF7 l\u1EC7 ho\u00E0n th\u00E0nh:",
  saveRate: "L\u01B0u t\u1EF7 l\u1EC7",
  refresh: "L\u00E0m m\u1EDBi d\u1EEF li\u1EC7u c\u01B0\u1EDBc",
  upload: "T\u1EA3i file c\u01B0\u1EDBc",
  refreshing: "\u0110ang l\u00E0m m\u1EDBi d\u1EEF li\u1EC7u...",
  filter: "B\u1ED9 l\u1ECDc",
  unsavedRate: "T\u1EF7 l\u1EC7 ch\u01B0a l\u01B0u",
  completionRateShort: "T\u1EF7 l\u1EC7 ho\u00E0n th\u00E0nh",
  saveShort: "L\u01B0u",
  emptyTitle: "Ch\u01B0a c\u00F3 d\u1EEF li\u1EC7u c\u01B0\u1EDBc",
  emptyDescription: "Th\u1EED \u0111\u1ED5i ng\u00E0y b\u00E1o c\u00E1o ho\u1EB7c import file c\u01B0\u1EDBc m\u1EDBi \u0111\u1EC3 c\u1EADp nh\u1EADt k\u1EBFt qu\u1EA3.",
  employee: "Nh\u00E2n vi\u00EAn",
  openingBalance: "\u0110\u1EA7u k\u1EF3",
  completion: "% Ho\u00E0n th\u00E0nh",
  missing: "Thi\u1EBFu \u0111\u1EC3 \u0111\u1EA1t",
  previous: "Tr\u01B0\u1EDBc",
  next: "Sau",
  page: "Trang",
  total: "T\u1ED5ng",
};

function formatAmount(value: number): string {
  return Math.round(Number(value || 0)).toLocaleString("vi-VN");
}

function renderDesktopRow(
  row: CuocRow,
  props: CuocPanelCleanProps,
  className?: string
) {
  const percent = Number(row.completionPercent || 0);
  const missing = Number(row.missingAmount || 0);
  return (
    <tr key={`desktop-${row.ctvUser}`} className={className}>
      <td className={`${styles.stickyFirst} ${styles.nameCell}`}>{row.ctvUser}</td>
      <td>{formatAmount(row.targetAmount)}</td>
      <td className={`${styles.metricCell} ${props.getPercentBgClass(percent)}`}>
        <span className={props.getPercentClass(percent)}>{percent.toFixed(2)}%</span>
      </td>
      <td className={`${styles.metricCell} ${props.getThieuBgClass(missing)}`}>
        <span className={props.getThieuClass(missing)}>{formatAmount(missing)}</span>
      </td>
    </tr>
  );
}

function renderMobileCard(
  row: CuocRow,
  props: CuocPanelCleanProps,
  className?: string
) {
  const percent = Number(row.completionPercent || 0);
  const missing = Number(row.missingAmount || 0);
  return (
    <div key={`mobile-${row.ctvUser}`} className={`glass-panel ${styles.mobileCard}${className ? ` ${className}` : ""}`}>
      <div className={styles.mobileHeader}>
        <div className={styles.mobileTitle}>{row.ctvUser}</div>
        <span className={`${props.surfaceBadgeClass} ${styles.statusBadge} ${props.getPercentBgClass(percent)}`}>
          {props.getStatusLabel(percent)}
        </span>
      </div>
      <div className={styles.mobileSummaryRows}>
        <div className={styles.mobileSummaryLine}>
          <span className={`${props.surfaceChipClass} ${styles.chip}`}>
            {copy.openingBalance}: {formatAmount(row.targetAmount)}
          </span>
        </div>
        <div className={styles.mobileSummaryLine}>
          <span className={`${props.surfaceChipClass} ${styles.chip} ${props.getPercentClass(percent)}`}>
            %: {percent.toFixed(2)}%
          </span>
          <span className={`${props.surfaceChipClass} ${styles.chip} ${props.getThieuClass(missing)}`}>
            {copy.missing}: {formatAmount(missing)}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function CuocPanelClean(props: CuocPanelCleanProps) {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className="ui-panel-heading">
          <h1 className={`${styles.title} ui-panel-title`}>{copy.title}</h1>
          <p className={`${styles.subtitle} ui-panel-subtitle`}>{copy.subtitle}</p>
        </div>
        <button className={props.surfaceActionBtnClass} onClick={props.onBack}>
          {copy.back}
        </button>
      </div>

      {!props.isCtv && (
        <div className={`glass-panel ${styles.toolbar} ${styles.mobileStickyFilter} ${styles.cdtDesktopToolbar}`}>
          <input
            type="date"
            className="input-base"
            value={props.reportDate}
            onChange={(event) => props.onReportDateChange(event.target.value)}
          />
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <span className={styles.refreshHint}>{copy.completionRate}</span>
            <input
              type="number"
              step="0.01"
              min="0"
              max="200"
              className="input-base"
              value={props.targetRate}
              onChange={(event) => props.onTargetRateChange(Number(event.target.value || 0))}
              disabled={!props.canAdmin}
              style={{ width: "110px" }}
            />
            <span className={styles.refreshHint}>%</span>
            {props.canAdmin && (
              <button
                className={props.surfaceActionBtnClass}
                onClick={props.onSaveRate}
                disabled={props.savingRate || !props.rateDirty}
              >
                {props.savingRate ? <Loader2 size={16} className="animate-spin" /> : copy.saveRate}
              </button>
            )}
          </div>
          <button className={props.surfaceActionBtnClass} onClick={props.onRefresh}>
            {copy.refresh}
          </button>
          {props.canAdmin && (
            <label className={props.surfacePrimaryBtnClass}>
              {props.importing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              {copy.upload}
              <input type="file" accept=".xlsx" hidden onChange={props.onImport} disabled={props.importing} />
            </label>
          )}
          {props.refreshing && <span className={styles.refreshHint}>{copy.refreshing}</span>}
        </div>
      )}

      {!props.isCtv && (
        <div className={`glass-panel ${styles.mobileStickyFilter} ${styles.cdtMobileToolbar}`}>
          <div className={styles.cdtMobileToolbarSummary}>
            <div className={styles.cdtMobileDateSummary} title={props.dateLabel}>
              <CalendarDays size={16} />
              <span>{props.dateLabel}</span>
            </div>
            <button
              type="button"
              className={`${props.surfaceActionBtnClass} ${styles.cdtMobileFilterToggle}`}
              onClick={props.onToggleMobileFilters}
              aria-expanded={props.showMobileFilters}
            >
              <span>{props.rateDirty ? `${copy.filter} (1)` : copy.filter}</span>
              {props.showMobileFilters ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
          {(props.refreshing || (props.canAdmin && props.rateDirty)) && (
            <div className={styles.cdtMobileFilterMeta}>
              {props.canAdmin && props.rateDirty ? (
                <span className={`${props.surfaceChipClass} ${styles.cdtMobileMetaChip}`}>
                  {copy.unsavedRate}: {props.targetRate}%
                </span>
              ) : null}
              {props.refreshing ? (
                <span className={`${props.surfaceChipClass} ${styles.cdtMobileMetaChip}`}>{copy.refreshing}</span>
              ) : null}
            </div>
          )}
          {props.showMobileFilters && (
            <div className={styles.cdtMobileFilterPanel}>
              <input
                type="date"
                className="input-base"
                value={props.reportDate}
                onChange={(event) => props.onReportDateChange(event.target.value)}
              />
              <div className={styles.cuocMobileRateSection}>
                <span className={styles.refreshHint}>{copy.completionRateShort}</span>
                <div className={styles.cuocMobileRateControls}>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="200"
                    className={`input-base ${styles.cuocMobileRateInput}`}
                    value={props.targetRate}
                    onChange={(event) => props.onTargetRateChange(Number(event.target.value || 0))}
                    disabled={!props.canAdmin}
                  />
                  <span className={styles.refreshHint}>%</span>
                  {props.canAdmin && (
                    <button
                      className={props.surfaceActionBtnClass}
                      onClick={props.onSaveRate}
                      disabled={props.savingRate || !props.rateDirty}
                    >
                      {props.savingRate ? <Loader2 size={16} className="animate-spin" /> : copy.saveShort}
                    </button>
                  )}
                </div>
              </div>
              <div className={styles.cdtMobileActionGrid}>
                <button className={props.surfaceActionBtnClass} onClick={props.onRefresh}>
                  {copy.refresh}
                </button>
                {props.canAdmin && (
                  <label className={`${props.surfacePrimaryBtnClass} ${styles.cdtMobileUploadBtn}`}>
                    {props.importing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                    {copy.upload}
                    <input type="file" accept=".xlsx" hidden onChange={props.onImport} disabled={props.importing} />
                  </label>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <PrepaidPanelState
        loading={props.loading}
        errorMessage={props.errorMessage}
        isEmpty={props.rows.length === 0}
        emptyTitle={copy.emptyTitle}
        emptyDescription={copy.emptyDescription}
        onRetry={props.onRefresh}
        actionBtnClass={props.surfaceActionBtnClass}
        skeletonStats={0}
        skeletonRows={6}
        skeletonCompact
      >
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.stickyFirst}>{copy.employee}</th>
                <th>{copy.openingBalance}</th>
                <th>{copy.completion}</th>
                <th>{copy.missing}</th>
              </tr>
            </thead>
            <tbody>
              {!props.isCtv && props.summaryRow ? renderDesktopRow(props.summaryRow, props, styles.summaryTotalRow) : null}
              {props.pagedRows.map((row) => renderDesktopRow(row, props))}
            </tbody>
          </table>

          <div className={styles.mobileCards}>
            {!props.isCtv && props.summaryRow ? renderMobileCard(props.summaryRow, props, styles.summaryTotalMobileCard) : null}
            {props.pagedRows.map((row) => renderMobileCard(row, props))}
          </div>

          {props.rows.length > props.pageSize && (
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
              <button
                className={props.surfacePaginationBtnClass}
                disabled={props.page <= 1}
                onClick={() => props.onPageChange((current) => Math.max(1, current - 1))}
              >
                {copy.previous}
              </button>
              <span className={styles.refreshHint}>
                {copy.page} {props.page}/{props.totalPages}
              </span>
              <button
                className={props.surfacePaginationBtnClass}
                disabled={props.page >= props.totalPages}
                onClick={() => props.onPageChange((current) => Math.min(props.totalPages, current + 1))}
              >
                {copy.next}
              </button>
            </div>
          )}
        </div>
      </PrepaidPanelState>
    </div>
  );
}
