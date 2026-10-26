"use client";

import { CalendarDays, ChevronDown, ChevronUp } from "lucide-react";
import DateRangePickerInput from "./DateRangePickerInput";
import PrepaidPanelState from "./PrepaidPanelState";
import styles from "./kpi.module.css";

type CdtSummaryRow = {
  ctvUser: string;
  nvThucHien: string;
  ftth: number;
  ths: number;
  camera: number;
  total: number;
  totalAmount: number;
};

type CdtSummaryTotals = {
  ftth: number;
  ths: number;
  camera: number;
  total: number;
  totalAmount: number;
};

type CdtSummaryPanelCleanProps = {
  canAdmin: boolean;
  fromDate: string;
  toDate: string;
  managerFilter: string;
  managerOptions: string[];
  dateRangeLabel: string;
  activeMobileFilterCount: number;
  showMobileFilters: boolean;
  loading: boolean;
  refreshing: boolean;
  errorMessage: string | null;
  rows: CdtSummaryRow[];
  totals: CdtSummaryTotals;
  page: number;
  totalPages: number;
  surfaceActionBtnClass: string;
  surfacePaginationBtnClass: string;
  surfaceBadgeClass: string;
  surfaceChipClass: string;
  onBack: () => void;
  onFromDateChange: (value: string) => void;
  onToDateChange: (value: string) => void;
  onManagerFilterChange: (value: string) => void;
  onRefresh: () => void;
  onToggleMobileFilters: () => void;
  onCloseMobileFilters: () => void;
  onPageChange: (value: number | ((current: number) => number)) => void;
};

export default function CdtSummaryPanelClean(props: CdtSummaryPanelCleanProps) {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className="ui-panel-heading">
          <h1 className={`${styles.title} ui-panel-title`}>Báo cáo CDT</h1>
          <p className={`${styles.subtitle} ui-panel-subtitle`}>Tổng hợp kết quả CDT theo nhân viên thực hiện.</p>
        </div>
        <button className={props.surfaceActionBtnClass} onClick={props.onBack}>
          Quay lại Chi tiết CDT
        </button>
      </div>

      <div className={`glass-panel ${styles.toolbar} ${styles.mobileStickyFilter} ${styles.cdtDesktopToolbar}`}>
        <div className={styles.dateRangeRow}>
          <DateRangePickerInput value={props.fromDate} onChange={props.onFromDateChange} title="Từ ngày" />
          <DateRangePickerInput value={props.toDate} onChange={props.onToDateChange} title="Tới ngày" />
        </div>
        {props.canAdmin && (
          <select
            className="input-base"
            value={props.managerFilter}
            onChange={(event) => props.onManagerFilterChange(event.target.value)}
          >
            <option value="">Tất cả quản lý</option>
            {props.managerOptions.map((manager) => (
              <option key={`cdt-r-m-${manager}`} value={manager}>
                {manager}
              </option>
            ))}
          </select>
        )}
        <button className={props.surfaceActionBtnClass} onClick={props.onRefresh}>
          Làm mới báo cáo CDT
        </button>
      </div>

      <div className={`glass-panel ${styles.mobileStickyFilter} ${styles.cdtMobileToolbar}`}>
        <div className={styles.cdtMobileToolbarSummary}>
          <div className={styles.cdtMobileDateSummary} title={props.dateRangeLabel}>
            <CalendarDays size={16} />
            <span>{props.dateRangeLabel}</span>
          </div>
          <button
            type="button"
            className={`${props.surfaceActionBtnClass} ${styles.cdtMobileFilterToggle}`}
            onClick={props.onToggleMobileFilters}
            aria-expanded={props.showMobileFilters}
          >
            <span>
              {props.activeMobileFilterCount > 0
                ? `Bộ lọc (${props.activeMobileFilterCount})`
                : "Bộ lọc"}
            </span>
            {props.showMobileFilters ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
        {(props.managerFilter || props.refreshing) && (
          <div className={styles.cdtMobileFilterMeta}>
            {props.canAdmin && props.managerFilter ? (
              <span className={`${props.surfaceChipClass} ${styles.cdtMobileMetaChip}`}>
                QL: {props.managerFilter}
              </span>
            ) : null}
            {props.refreshing ? (
              <span className={`${props.surfaceChipClass} ${styles.cdtMobileMetaChip}`}>Đang làm mới...</span>
            ) : null}
          </div>
        )}
        {props.showMobileFilters && (
          <div className={styles.cdtMobileFilterPanel}>
            <div className={styles.dateRangeRow}>
              <DateRangePickerInput value={props.fromDate} onChange={props.onFromDateChange} title="Từ ngày" />
              <DateRangePickerInput value={props.toDate} onChange={props.onToDateChange} title="Tới ngày" />
            </div>
            {props.canAdmin && (
              <select
                className="input-base"
                value={props.managerFilter}
                onChange={(event) => props.onManagerFilterChange(event.target.value)}
              >
                <option value="">Tất cả quản lý</option>
                {props.managerOptions.map((manager) => (
                  <option key={`cdt-report-mobile-m-${manager}`} value={manager}>
                    {manager}
                  </option>
                ))}
              </select>
            )}
            <div className={styles.cdtMobileActionGrid}>
              <button className={props.surfaceActionBtnClass} onClick={props.onRefresh}>
                Làm mới
              </button>
              <button className={props.surfaceActionBtnClass} onClick={props.onCloseMobileFilters}>
                Chi tiết
              </button>
            </div>
          </div>
        )}
      </div>

      <PrepaidPanelState
        loading={props.loading}
        errorMessage={props.errorMessage}
        isEmpty={props.rows.length === 0}
        emptyTitle="Chưa có báo cáo CDT"
        emptyDescription="Thử điều chỉnh khoảng ngày hoặc bộ lọc quản lý để xem tổng hợp."
        onRetry={props.onRefresh}
        actionBtnClass={props.surfaceActionBtnClass}
        skeletonStats={3}
        skeletonRows={6}
      >
        <>
          <div className={`glass-panel ${styles.cdtReportStats} ${styles.cdtDesktopStats}`}>
            <div className={`${styles.cdtReportStatCard} ${styles.cdtReportStatPrimary}`}>
              <span>Tổng giao dịch</span>
              <strong>{props.totals.total}</strong>
              <em>Toàn bộ giao dịch trong bộ lọc hiện tại</em>
            </div>
            <div className={`${styles.cdtReportStatCard} ${styles.cdtReportStatMoney}`}>
              <span>Tổng tiền</span>
              <strong>{Math.round(props.totals.totalAmount).toLocaleString("vi-VN")}</strong>
              <em>Giá trị thu về từ gia hạn CDT</em>
            </div>
            <div className={styles.cdtReportStatCard}>
              <span>Cơ cấu thuê bao</span>
              <div className={styles.cdtReportBreakdown}>
                <div className={`${styles.cdtBreakdownItem} ${styles.cdtToneFtth}`}>
                  <label>FTTH</label>
                  <strong>{props.totals.ftth}</strong>
                </div>
                <div className={`${styles.cdtBreakdownItem} ${styles.cdtToneThs}`}>
                  <label>THS</label>
                  <strong>{props.totals.ths}</strong>
                </div>
                <div className={`${styles.cdtBreakdownItem} ${styles.cdtToneCamera}`}>
                  <label>Camera</label>
                  <strong>{props.totals.camera}</strong>
                </div>
              </div>
            </div>
          </div>

          <div className={`${styles.tableWrap} ${styles.cdtReportWrap}`}>
            <table className={`${styles.table} ${styles.cdtReportTable}`}>
              <thead>
                <tr>
                  <th className={styles.stickyFirst}>STT</th>
                  <th>NV THỰC HIỆN</th>
                  <th>FTTH</th>
                  <th>THS</th>
                  <th>CAMERA</th>
                  <th>TỔNG</th>
                  <th>TỔNG TIỀN</th>
                </tr>
              </thead>
              <tbody>
                {props.rows.map((row, idx) => (
                  <tr key={`sum-${row.ctvUser}`}>
                    <td className={`${styles.stickyFirst} ${styles.nameCell}`}>{idx + 1}</td>
                    <td className={styles.cdtReportNameCell}>{row.nvThucHien}</td>
                    <td className={styles.numberCell}>{row.ftth}</td>
                    <td className={styles.numberCell}>{row.ths}</td>
                    <td className={styles.numberCell}>{row.camera}</td>
                    <td className={styles.numberCell}>{row.total}</td>
                    <td className={styles.cdtMoneyCell}>
                      {Math.round(row.totalAmount).toLocaleString("vi-VN")}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td className={`${styles.stickyFirst} ${styles.nameCell}`} colSpan={2}>
                    TỔNG
                  </td>
                  <td className={styles.numberCell}>
                    <strong>{props.totals.ftth}</strong>
                  </td>
                  <td className={styles.numberCell}>
                    <strong>{props.totals.ths}</strong>
                  </td>
                  <td className={styles.numberCell}>
                    <strong>{props.totals.camera}</strong>
                  </td>
                  <td className={styles.numberCell}>
                    <strong>{props.totals.total}</strong>
                  </td>
                  <td className={styles.cdtMoneyCell}>
                    <strong>{Math.round(props.totals.totalAmount).toLocaleString("vi-VN")}</strong>
                  </td>
                </tr>
              </tbody>
            </table>

            <div className={`${styles.mobileCards} ${styles.cdtReportMobileCards}`}>
              {props.rows.map((row, idx) => (
                <div
                  key={`cdt-sum-mobile-${row.ctvUser}`}
                  className={`glass-panel ${styles.mobileCard} ${styles.cdtReportMobileCard}`}
                >
                  <div className={`${styles.mobileHeader} ${styles.cdtReportMobileHeader}`}>
                    <div className={styles.mobileTitle}>
                      {idx + 1}. {row.nvThucHien}
                    </div>
                    <span className={`${props.surfaceBadgeClass} ${styles.statusBadge}`}>Tổng: {row.total}</span>
                  </div>
                  <div className={styles.mobileSummaryRows}>
                    <div className={styles.mobileSummaryLine}>
                      <span className={`${props.surfaceChipClass} ${styles.chip}`}>FTTH: {row.ftth}</span>
                      <span className={`${props.surfaceChipClass} ${styles.chip}`}>THS: {row.ths}</span>
                      <span className={`${props.surfaceChipClass} ${styles.chip}`}>Camera: {row.camera}</span>
                    </div>
                    <div className={styles.mobileSummaryLine}>
                      <span className={`${props.surfaceChipClass} ${styles.chip}`}>
                        Tổng tiền: {Math.round(row.totalAmount).toLocaleString("vi-VN")}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              <div
                className={`glass-panel ${styles.mobileCard} ${styles.cdtReportMobileCard} ${styles.cdtReportTotalMobileCard}`}
              >
                <div className={`${styles.mobileHeader} ${styles.cdtReportMobileHeader}`}>
                  <div className={styles.mobileTitle}>TỔNG</div>
                </div>
                <div className={styles.mobileSummaryRows}>
                  <div className={styles.mobileSummaryLine}>
                    <span className={`${props.surfaceChipClass} ${styles.chip}`}>FTTH: {props.totals.ftth}</span>
                    <span className={`${props.surfaceChipClass} ${styles.chip}`}>THS: {props.totals.ths}</span>
                    <span className={`${props.surfaceChipClass} ${styles.chip}`}>Camera: {props.totals.camera}</span>
                    <span className={`${props.surfaceChipClass} ${styles.chip}`}>Tổng: {props.totals.total}</span>
                  </div>
                  <div className={styles.mobileSummaryLine}>
                    <span className={`${props.surfaceChipClass} ${styles.chip}`}>
                      Tổng tiền: {Math.round(props.totals.totalAmount).toLocaleString("vi-VN")}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {props.totalPages > 1 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, padding: "10px 12px" }}>
                <button
                  className={props.surfacePaginationBtnClass}
                  disabled={props.page <= 1}
                  onClick={() => props.onPageChange((current) => Math.max(1, current - 1))}
                >
                  Trước
                </button>
                <span className={styles.refreshHint}>Trang {props.page}/{props.totalPages}</span>
                <button
                  className={props.surfacePaginationBtnClass}
                  disabled={props.page >= props.totalPages}
                  onClick={() => props.onPageChange((current) => Math.min(props.totalPages, current + 1))}
                >
                  Sau
                </button>
              </div>
            )}
          </div>
        </>
      </PrepaidPanelState>
    </div>
  );
}
