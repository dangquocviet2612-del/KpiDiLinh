"use client";

import type { ChangeEvent } from "react";
import { CalendarDays, ChevronDown, ChevronUp, Loader2, Upload } from "lucide-react";
import DateRangePickerInput from "./DateRangePickerInput";
import PrepaidPanelState from "./PrepaidPanelState";
import styles from "./kpi.module.css";

type CtvOption = {
  id: string | number;
  username: string;
};

type CdtRow = {
  transactionDate: string;
  transactionTime?: string | null;
  ctvUser: string;
  subscriberType?: string | null;
  account: string;
  amount: number;
  months: number;
};

type CdtTotals = {
  count: number;
  totalAmount: number;
  totalMonths: number;
  ftth: number;
  ths: number;
  camera: number;
};

type CdtPanelCleanProps = {
  canAdmin: boolean;
  canSelectCtv: boolean;
  canViewSummaryReport: boolean;
  showActorColumn: boolean;
  fromDate: string;
  toDate: string;
  accountFilter: string;
  selectedCtv: string;
  managerFilter: string;
  managerOptions: string[];
  ctvOptions: CtvOption[];
  dateRangeLabel: string;
  activeMobileFilterCount: number;
  showMobileFilters: boolean;
  loading: boolean;
  refreshing: boolean;
  importing: boolean;
  exportingMonth: boolean;
  errorMessage: string | null;
  rows: CdtRow[];
  totals: CdtTotals;
  page: number;
  totalPages: number;
  surfaceActionBtnClass: string;
  surfacePrimaryBtnClass: string;
  surfacePaginationBtnClass: string;
  surfaceBadgeClass: string;
  surfaceChipClass: string;
  formatIsoToVnDate: (value?: string | null) => string;
  getCdtTypeToneClass: (subscriberType?: string | null) => string;
  onBack: () => void;
  onOpenReport: () => void;
  onOpenOutstanding: () => void;
  onExportMonth: () => void;
  onImport: (event: ChangeEvent<HTMLInputElement>) => void;
  onFromDateChange: (value: string) => void;
  onToDateChange: (value: string) => void;
  onAccountFilterChange: (value: string) => void;
  onSelectedCtvChange: (value: string) => void;
  onManagerFilterChange: (value: string) => void;
  onRefresh: () => void;
  onToggleMobileFilters: () => void;
  onPageChange: (value: number | ((current: number) => number)) => void;
};

export default function CdtPanelClean(props: CdtPanelCleanProps) {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className="ui-panel-heading">
          <h1 className={`${styles.title} ui-panel-title`}>CDT</h1>
          <p className={`${styles.subtitle} ui-panel-subtitle`}>
            Theo dõi giao dịch gia hạn theo ngày: thuê bao, số tiền, số tháng.
          </p>
        </div>
        <div className={styles.cdtHeaderActions}>
          <button className={props.surfaceActionBtnClass} onClick={props.onBack}>
            Quay lại KPI
          </button>
          {props.canViewSummaryReport && (
            <button
              className={`${props.surfaceActionBtnClass} ${styles.cdtMobileHeaderAction}`}
              onClick={props.onOpenReport}
            >
              Báo cáo CDT
            </button>
          )}
          <button
            className={`${props.surfaceActionBtnClass} ${styles.cdtMobileHeaderAction}`}
            onClick={props.onOpenOutstanding}
          >
            Tồn CDT
          </button>
          {props.canAdmin && (
            <button
            className={`${props.surfaceActionBtnClass} ${styles.cdtMobileHeaderAction}`}
            onClick={props.onExportMonth}
            disabled={props.exportingMonth}
          >
              {props.exportingMonth ? <Loader2 size={16} className="animate-spin" /> : null}
              Tải Excel tháng
            </button>
          )}
          {props.canAdmin && (
            <label className={`${props.surfacePrimaryBtnClass} ${styles.cdtMobileHeaderAction}`}>
              {props.importing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              Tải file CDT
              <input type="file" accept=".xlsx,.xls" hidden onChange={props.onImport} disabled={props.importing} />
            </label>
          )}
        </div>
      </div>

      <div className={`glass-panel ${styles.toolbar} ${styles.mobileStickyFilter} ${styles.cdtDesktopToolbar}`}>
        <div className={styles.dateRangeRow}>
          <DateRangePickerInput value={props.fromDate} onChange={props.onFromDateChange} title="Từ ngày" />
          <DateRangePickerInput value={props.toDate} onChange={props.onToDateChange} title="Tới ngày" />
        </div>
        <input
          className="input-base"
          placeholder="Tìm theo thuê bao"
          value={props.accountFilter}
          onChange={(event) => props.onAccountFilterChange(event.target.value)}
        />
        {props.canSelectCtv && (
          <select
            className="input-base"
            value={props.selectedCtv}
            onChange={(event) => props.onSelectedCtvChange(event.target.value)}
          >
            <option value="">Tất cả CTV</option>
            {props.ctvOptions.map((user) => (
              <option key={`cdt-${user.id}`} value={user.username}>
                {user.username}
              </option>
            ))}
          </select>
        )}
        {props.canAdmin && (
          <select
            className="input-base"
            value={props.managerFilter}
            onChange={(event) => props.onManagerFilterChange(event.target.value)}
          >
            <option value="">Tất cả quản lý</option>
            {props.managerOptions.map((manager) => (
              <option key={`cdt-m-${manager}`} value={manager}>
                {manager}
              </option>
            ))}
          </select>
        )}
        <button className={props.surfaceActionBtnClass} onClick={props.onRefresh}>
          Làm mới dữ liệu CDT
        </button>
        {props.canViewSummaryReport && (
          <button className={props.surfaceActionBtnClass} onClick={props.onOpenReport}>
            Mở báo cáo CDT
          </button>
        )}
        <button className={props.surfaceActionBtnClass} onClick={props.onOpenOutstanding}>
          Tồn CDT
        </button>
        {props.canAdmin && (
          <button className={props.surfaceActionBtnClass} onClick={props.onExportMonth} disabled={props.exportingMonth}>
            {props.exportingMonth ? <Loader2 size={16} className="animate-spin" /> : null}
            Tải Excel tháng
          </button>
        )}
        {props.canAdmin && (
          <label className={props.surfacePrimaryBtnClass}>
            {props.importing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            Tải file CDT
            <input type="file" accept=".xlsx,.xls" hidden onChange={props.onImport} disabled={props.importing} />
          </label>
        )}
        {props.refreshing && <span className={styles.refreshHint}>Đang làm mới dữ liệu...</span>}
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
        {(props.accountFilter || props.selectedCtv || props.managerFilter || props.refreshing) && (
          <div className={styles.cdtMobileFilterMeta}>
            {props.accountFilter ? (
              <span className={`${props.surfaceChipClass} ${styles.cdtMobileMetaChip}`}>Thuê bao: {props.accountFilter}</span>
            ) : null}
            {props.selectedCtv ? (
              <span className={`${props.surfaceChipClass} ${styles.cdtMobileMetaChip}`}>CTV: {props.selectedCtv}</span>
            ) : null}
            {props.canAdmin && props.managerFilter ? (
              <span className={`${props.surfaceChipClass} ${styles.cdtMobileMetaChip}`}>QL: {props.managerFilter}</span>
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
            <input
              className="input-base"
              placeholder="Tìm theo thuê bao"
              value={props.accountFilter}
              onChange={(event) => props.onAccountFilterChange(event.target.value)}
            />
            {props.canSelectCtv && (
              <select
                className="input-base"
                value={props.selectedCtv}
                onChange={(event) => props.onSelectedCtvChange(event.target.value)}
              >
                <option value="">Tất cả CTV</option>
                {props.ctvOptions.map((user) => (
                  <option key={`cdt-mobile-${user.id}`} value={user.username}>
                    {user.username}
                  </option>
                ))}
              </select>
            )}
            {props.canAdmin && (
              <select
                className="input-base"
                value={props.managerFilter}
                onChange={(event) => props.onManagerFilterChange(event.target.value)}
              >
                <option value="">Tất cả quản lý</option>
                {props.managerOptions.map((manager) => (
                  <option key={`cdt-mobile-m-${manager}`} value={manager}>
                    {manager}
                  </option>
                ))}
              </select>
            )}
            <div className={styles.cdtMobileActionGrid}>
              <button className={props.surfaceActionBtnClass} onClick={props.onRefresh}>
                Làm mới
              </button>
            </div>
          </div>
        )}
      </div>

      <PrepaidPanelState
        loading={props.loading}
        errorMessage={props.errorMessage}
        isEmpty={props.rows.length === 0}
        emptyTitle="Chưa có giao dịch CDT"
        emptyDescription="Thử điều chỉnh khoảng ngày hoặc bộ lọc CTV để tải dữ liệu."
        onRetry={props.onRefresh}
        actionBtnClass={props.surfaceActionBtnClass}
        skeletonStats={3}
        skeletonRows={6}
      >
        <>
          <div className={`glass-panel ${styles.cdtReportStats} ${styles.cdtDesktopStats}`}>
            <div className={`${styles.cdtReportStatCard} ${styles.cdtReportStatPrimary}`}>
              <span>Số giao dịch</span>
              <strong>{props.totals.count}</strong>
              <em>Toàn bộ giao dịch trong bộ lọc CDT hiện tại</em>
            </div>
            <div className={`${styles.cdtReportStatCard} ${styles.cdtReportStatMoney}`}>
              <span>Tổng tiền</span>
              <strong>{Math.round(props.totals.totalAmount).toLocaleString("vi-VN")}</strong>
              <em>Giá trị thu về từ các giao dịch gia hạn CDT</em>
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

          <div className={styles.cdtMobileStatsGrid}>
            <div className={styles.cdtMobileStatCard}>
              <span>Số giao dịch</span>
              <strong>{props.totals.count}</strong>
            </div>
            <div className={`${styles.cdtMobileStatCard} ${styles.cdtMobileStatMoney}`}>
              <span>Tổng tiền</span>
              <strong>{Math.round(props.totals.totalAmount).toLocaleString("vi-VN")}</strong>
            </div>
            <div className={`${styles.cdtMobileStatCard} ${styles.cdtMobileBreakdownCard}`}>
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

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.stickyFirst}>Ngày</th>
                  <th>Thời gian</th>
                  {props.showActorColumn && <th>CTV</th>}
                  <th>Loại TB</th>
                  <th>Thuê bao CDT</th>
                  <th>Số tiền CDT</th>
                  <th>Số tháng CDT</th>
                </tr>
              </thead>
              <tbody>
                {props.rows.map((row, idx) => (
                  <tr key={`${row.transactionDate}-${row.ctvUser}-${row.account}-${idx}`}>
                    <td className={`${styles.stickyFirst} ${styles.nameCell}`}>
                      {props.formatIsoToVnDate(row.transactionDate) || row.transactionDate}
                    </td>
                    <td>{row.transactionTime || "-"}</td>
                    {props.showActorColumn && <td>{row.ctvUser}</td>}
                    <td>
                      <span className={`${styles.cdtTypePill} ${props.getCdtTypeToneClass(row.subscriberType)}`}>
                        {row.subscriberType || "-"}
                      </span>
                    </td>
                    <td className={styles.cdtAccountCell}>{row.account}</td>
                    <td className={styles.cdtMoneyCell}>
                      {Math.round(Number(row.amount || 0)).toLocaleString("vi-VN")}
                    </td>
                    <td className={styles.numberCell}>{Number(row.months || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className={styles.mobileCards}>
              {props.rows.map((row, idx) => (
                <div key={`cdt-mobile-${idx}`} className={`glass-panel ${styles.mobileCard} ${styles.cdtMobileCard}`}>
                  <div className={`${styles.mobileHeader} ${styles.cdtMobileHeader}`}>
                    <div className={`${styles.mobileTitle} ${styles.cdtAccount}`}>{row.account}</div>
                    <span className={`${props.surfaceBadgeClass} ${styles.statusBadge} ${styles.cdtDateBadge}`}>
                      {props.formatIsoToVnDate(row.transactionDate) || row.transactionDate}
                    </span>
                  </div>
                  <div className={styles.mobileSummaryRows}>
                    {props.showActorColumn && (
                      <div className={styles.mobileSummaryLine}>
                        <span className={`${props.surfaceChipClass} ${styles.chip}`}>CTV: {row.ctvUser}</span>
                      </div>
                    )}
                    <div className={styles.mobileSummaryLine}>
                      <span className={`${props.surfaceChipClass} ${styles.chip}`}>Loại TB: {row.subscriberType || "-"}</span>
                    </div>
                    <div className={styles.mobileSummaryLine}>
                      <span className={`${props.surfaceChipClass} ${styles.chip}`}>Thời gian: {row.transactionTime || "-"}</span>
                    </div>
                    <div className={styles.mobileSummaryLine}>
                      <span className={`${props.surfaceChipClass} ${styles.chip}`}>
                        Tiền: {Math.round(Number(row.amount || 0)).toLocaleString("vi-VN")}
                      </span>
                      <span className={`${props.surfaceChipClass} ${styles.chip}`}>
                        Tháng: {Number(row.months || 0)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
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
