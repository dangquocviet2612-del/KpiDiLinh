"use client";

import type { ChangeEvent } from "react";
import { useState, useMemo } from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Loader2,
  Upload,
  Search,
  RefreshCw,
  Layers,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ArrowDownUp,
} from "lucide-react";
import PrepaidPanelState from "./PrepaidPanelState";
import styles from "./kpi.module.css";
import type { CuocCdRow, CuocCdSummaryRow, CuocCdSortField, CuocCdSortDirection } from "@/lib/cuoc-cd-sorting";
import { sortCuocCdRows } from "@/lib/cuoc-cd-sorting";

type CuocCdPanelCleanProps = {
  canAdmin: boolean;
  isCtv?: boolean;
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
  rows: CuocCdRow[];
  summaryRow: CuocCdSummaryRow | null;
  pagedRows: CuocCdRow[];
  page: number;
  totalPages: number;
  pageSize: number;
  surfaceActionBtnClass: string;
  surfacePrimaryBtnClass: string;
  surfacePaginationBtnClass: string;
  surfaceBadgeClass: string;
  surfaceChipClass: string;
  onBack: () => void;
  onReportDateChange: (value: string) => void;
  onTargetRateChange: (value: number) => void;
  onSaveRate: () => void;
  onRefresh: () => void;
  onImport: (event: ChangeEvent<HTMLInputElement>) => void;
  onToggleMobileFilters: () => void;
  onPageChange: (value: number | ((current: number) => number)) => void;
};

function formatInteger(val: number): string {
  return Math.round(Number(val || 0)).toLocaleString("vi-VN");
}

function formatDecimal(val: number): string {
  const num = Number(val || 0);
  if (Number.isInteger(num)) return num.toLocaleString("vi-VN");
  return num.toLocaleString("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function CuocCdPanelClean(props: CuocCdPanelCleanProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<CuocCdSortField | null>(null);
  const [sortDirection, setSortDirection] = useState<CuocCdSortDirection>("desc");

  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) return props.rows;
    const term = searchTerm.toLowerCase().trim();
    return props.rows.filter(
      (r) =>
        r.employeeCodeRaw.toLowerCase().includes(term) ||
        r.ctvUser.toLowerCase().includes(term) ||
        r.managerCodeRaw.toLowerCase().includes(term)
    );
  }, [props.rows, searchTerm]);

  const sortedRows = useMemo(() => {
    return sortCuocCdRows(filteredRows, sortField, sortDirection);
  }, [filteredRows, sortField, sortDirection]);

  const totalPagesFiltered = useMemo(
    () => Math.max(1, Math.ceil(sortedRows.length / props.pageSize)),
    [sortedRows.length, props.pageSize]
  );

  const displayPagedRows = useMemo(() => {
    return sortedRows.slice((props.page - 1) * props.pageSize, props.page * props.pageSize);
  }, [sortedRows, props.page, props.pageSize]);

  const handleHeaderSort = (field: CuocCdSortField) => {
    if (sortField !== field) {
      setSortField(field);
      // For string (employeeCodeRaw), default to "asc", for numeric default to "desc" (highest debt/shortage first)
      setSortDirection(field === "employeeCodeRaw" ? "asc" : "desc");
    } else {
      const defaultDir: CuocCdSortDirection = field === "employeeCodeRaw" ? "asc" : "desc";
      if (sortDirection === defaultDir) {
        setSortDirection(defaultDir === "asc" ? "desc" : "asc");
      } else {
        // 3-state cycle: reset sort back to default file order
        setSortField(null);
        setSortDirection("asc");
      }
    }
    props.onPageChange(1);
  };

  const sortOptions = [
    { value: "default", label: "Mặc định (Theo file)" },
    { value: "thuaThieu_desc", label: "Thừa/Thiếu: Thiếu nhiều nhất (Cần thu)" },
    { value: "thuaThieu_asc", label: "Thừa/Thiếu: Đã đạt / Thừa nhiều nhất" },
    { value: "tonChuaThu_desc", label: "Còn tồn: Chưa thu nhiều nhất" },
    { value: "tonChuaThu_asc", label: "Còn tồn: Chưa thu ít nhất" },
    { value: "dauKy_desc", label: "Đầu kỳ: Cao → Thấp" },
    { value: "dauKy_asc", label: "Đầu kỳ: Thấp → Cao" },
    { value: "luyKe_desc", label: "Lũy kế: Thu nhiều nhất" },
    { value: "luyKe_asc", label: "Lũy kế: Thu ít nhất" },
    { value: "employeeCodeRaw_asc", label: "User CNKD: A → Z" },
    { value: "employeeCodeRaw_desc", label: "User CNKD: Z → A" },
  ];

  const currentSortValue = sortField ? `${sortField}_${sortDirection}` : "default";

  const handleSortSelectChange = (value: string) => {
    if (value === "default") {
      setSortField(null);
      setSortDirection("asc");
    } else {
      const [field, dir] = value.split("_") as [CuocCdSortField, CuocCdSortDirection];
      setSortField(field);
      setSortDirection(dir);
    }
    props.onPageChange(1);
  };

  const renderSortIcon = (field: CuocCdSortField) => {
    if (sortField !== field) {
      return <ArrowUpDown size={14} className={styles.sortIconInactive} aria-hidden="true" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp size={14} className={styles.sortIconActive} aria-hidden="true" />
    ) : (
      <ArrowDown size={14} className={styles.sortIconActive} aria-hidden="true" />
    );
  };

  const renderRow = (row: CuocCdRow | CuocCdSummaryRow, isSummary = false) => {
    const isSum = isSummary || "isSummary" in row;
    const empCode = isSum ? "Tổng" : (row as CuocCdRow).employeeCodeRaw;
    const thuaThieu = row.thuaThieu;
    const tonChuaThu = row.tonChuaThu;

    const thuaThieuClass = thuaThieu <= 0 ? styles.good : thuaThieu > 2 ? styles.bad : styles.warn;
    const thuaThieuBg = thuaThieu <= 0 ? styles.goodBg : thuaThieu > 2 ? styles.badBg : styles.warnBg;
    const tonClass = tonChuaThu <= 0 ? styles.good : styles.bad;
    const tonBg = tonChuaThu <= 0 ? styles.goodBg : styles.badBg;

    return (
      <tr
        key={isSum ? "summary-row" : `row-${empCode}`}
        className={isSum ? styles.summaryTotalRow : undefined}
        style={isSum ? { fontWeight: 700, backgroundColor: "var(--accent-subtle, rgba(220, 38, 38, 0.05))" } : undefined}
      >
        <td className={`${styles.stickyFirst} ${styles.nameCell}`}>
          <span style={isSum ? { color: "var(--primary, #e11d48)", fontWeight: 700 } : undefined}>
            {empCode}
          </span>
        </td>
        <td>{formatInteger(row.dauKy)}</td>
        <td>{formatInteger(row.luyKe)}</td>
        <td className={`${styles.metricCell} ${thuaThieuBg}`}>
          <span className={thuaThieuClass}>{formatDecimal(thuaThieu)}</span>
        </td>
        <td className={`${styles.metricCell} ${tonBg}`}>
          <span className={tonClass}>{formatInteger(tonChuaThu)}</span>
        </td>
      </tr>
    );
  };

  const renderMobileCard = (row: CuocCdRow | CuocCdSummaryRow, isSummary = false) => {
    const isSum = isSummary || "isSummary" in row;
    const empCode = isSum ? "Tổng" : (row as CuocCdRow).employeeCodeRaw;
    const thuaThieu = row.thuaThieu;
    const tonChuaThu = row.tonChuaThu;

    const thuaThieuClass = thuaThieu <= 0 ? styles.good : thuaThieu > 2 ? styles.bad : styles.warn;
    const tonClass = tonChuaThu <= 0 ? styles.good : styles.bad;

    return (
      <div
        key={isSum ? "mobile-summary" : `mobile-${empCode}`}
        className={`glass-panel ${styles.mobileCard} ${isSum ? styles.summaryTotalMobileCard : ""}`}
      >
        <div className={styles.mobileHeader}>
          <div className={styles.mobileTitle} style={isSum ? { color: "var(--primary, #e11d48)", fontWeight: 700 } : undefined}>
            {empCode}
          </div>
          <span className={`${props.surfaceBadgeClass} ${styles.statusBadge}`}>
            Tồn: <strong className={tonClass} style={{ marginLeft: 4 }}>{formatInteger(tonChuaThu)}</strong>
          </span>
        </div>
        <div className={styles.mobileSummaryRows}>
          <div className={styles.mobileSummaryLine}>
            <span className={`${props.surfaceChipClass} ${styles.chip}`}>
              Đầu kỳ: <strong>{formatInteger(row.dauKy)}</strong>
            </span>
            <span className={`${props.surfaceChipClass} ${styles.chip}`}>
              Lũy kế: <strong>{formatInteger(row.luyKe)}</strong>
            </span>
          </div>
          <div className={styles.mobileSummaryLine}>
            <span className={`${props.surfaceChipClass} ${styles.chip} ${thuaThieuClass}`}>
              Thừa/Thiếu: <strong>{formatDecimal(thuaThieu)}</strong>
            </span>
            <span className={`${props.surfaceChipClass} ${styles.chip} ${tonClass}`}>
              Tồn chưa thu: <strong>{formatInteger(tonChuaThu)}</strong>
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className="ui-panel-heading">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Layers className="text-rose-500" size={26} />
            <h1 className={`${styles.title} ui-panel-title`}>Cước Cố Định (Cước CD)</h1>
          </div>
          <p className={`${styles.subtitle} ui-panel-subtitle`}>
            Báo cáo dữ liệu cước cố định theo User CNKD
          </p>
        </div>
        <button className={props.surfaceActionBtnClass} onClick={props.onBack}>
          Quay lại KPI
        </button>
      </div>

      {/* Desktop Toolbar */}
      <div className={`glass-panel ${styles.toolbar} ${styles.mobileStickyFilter} ${styles.cdtDesktopToolbar}`}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <CalendarDays size={18} className="text-gray-500" />
          <input
            type="date"
            className="input-base"
            value={props.reportDate}
            onChange={(e) => props.onReportDateChange(e.target.value)}
          />
        </div>

        {/* Target Rate Input - ONLY ADMIN CAN SEE AND EDIT */}
        {props.canAdmin && (
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--text-muted, #64748b)", whiteSpace: "nowrap" }}>
              Tỉ lệ giao:
            </span>
            <input
              type="number"
              step="0.1"
              min="0"
              max="200"
              className="input-base"
              value={props.targetRate}
              onChange={(e) => props.onTargetRateChange(Number(e.target.value || 0))}
              style={{ width: "85px" }}
            />
            <span style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--text-muted, #64748b)" }}>%</span>
            <button
              className={props.surfaceActionBtnClass}
              onClick={props.onSaveRate}
              disabled={props.savingRate || !props.rateDirty}
            >
              {props.savingRate ? <Loader2 size={16} className="animate-spin" /> : "Lưu tỷ lệ"}
            </button>
          </div>
        )}

        {/* Search */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, maxWidth: 260 }}>
          <div style={{ position: "relative", width: "100%" }}>
            <Search size={16} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted, #94a3b8)" }} />
            <input
              type="text"
              placeholder="Tìm User CNKD..."
              className="input-base"
              style={{ paddingLeft: 34, width: "100%" }}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                props.onPageChange(1);
              }}
            />
          </div>
        </div>

        {/* Quick Sort Dropdown */}
        <div className={styles.sortSelectWrap} title="Sắp xếp dữ liệu">
          <ArrowDownUp size={16} className="text-gray-400" />
          <select
            className="input-base"
            value={currentSortValue}
            onChange={(e) => handleSortSelectChange(e.target.value)}
            aria-label="Sắp xếp danh sách"
          >
            {sortOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <button className={props.surfaceActionBtnClass} onClick={props.onRefresh} title="Làm mới dữ liệu">
          <RefreshCw size={16} className={props.refreshing ? "animate-spin" : ""} />
          Làm mới
        </button>

        {!props.isCtv && (
          <label className={props.surfacePrimaryBtnClass} style={{ cursor: "pointer" }}>
            {props.importing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            Tải file Cước CD
            <input type="file" accept=".xlsx" hidden onChange={props.onImport} disabled={props.importing} />
          </label>
        )}

        {props.refreshing && <span className={styles.refreshHint}>Đang làm mới dữ liệu...</span>}
      </div>

      {/* Mobile Toolbar Toggle */}
      <div className={`glass-panel ${styles.mobileStickyFilter} ${styles.cdtMobileToolbar}`}>
        <div className={styles.cdtMobileToolbarSummary}>
          <div className={styles.cdtMobileDateSummary} title={props.dateLabel}>
            <CalendarDays size={16} />
            <span>{props.dateLabel || "Chọn ngày"}</span>
          </div>
          <button
            type="button"
            className={`${props.surfaceActionBtnClass} ${styles.cdtMobileFilterToggle}`}
            onClick={props.onToggleMobileFilters}
            aria-expanded={props.showMobileFilters}
          >
            <span>{props.rateDirty ? "Bộ lọc (1)" : "Bộ lọc"}</span>
            {props.showMobileFilters ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {props.showMobileFilters && (
          <div className={styles.cdtMobileFilterPanel}>
            <input
              type="date"
              className="input-base"
              value={props.reportDate}
              onChange={(e) => props.onReportDateChange(e.target.value)}
            />

            {/* Target Rate Input - ONLY ADMIN CAN SEE AND EDIT ON MOBILE */}
            {props.canAdmin && (
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 500, whiteSpace: "nowrap" }}>Tỉ lệ giao:</span>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="200"
                  className="input-base"
                  value={props.targetRate}
                  onChange={(e) => props.onTargetRateChange(Number(e.target.value || 0))}
                  style={{ width: "85px" }}
                />
                <span>%</span>
                <button
                  className={props.surfaceActionBtnClass}
                  onClick={props.onSaveRate}
                  disabled={props.savingRate || !props.rateDirty}
                >
                  {props.savingRate ? <Loader2 size={16} className="animate-spin" /> : "Lưu tỷ lệ"}
                </button>
              </div>
            )}

            <input
              type="text"
              placeholder="Tìm User CNKD..."
              className="input-base"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                props.onPageChange(1);
              }}
            />

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted, #64748b)" }}>
                Sắp xếp:
              </span>
              <select
                className="input-base"
                value={currentSortValue}
                onChange={(e) => handleSortSelectChange(e.target.value)}
              >
                {sortOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.cdtMobileActionGrid}>
              <button className={props.surfaceActionBtnClass} onClick={props.onRefresh}>
                <RefreshCw size={16} className={props.refreshing ? "animate-spin" : ""} /> Làm mới
              </button>
              {!props.isCtv && (
                <label className={`${props.surfacePrimaryBtnClass} ${styles.cdtMobileUploadBtn}`}>
                  {props.importing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                  Tải file Cước CD
                  <input type="file" accept=".xlsx" hidden onChange={props.onImport} disabled={props.importing} />
                </label>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Content Table / Cards */}
      <PrepaidPanelState
        loading={props.loading}
        errorMessage={props.errorMessage}
        isEmpty={filteredRows.length === 0}
        emptyTitle="Chưa có dữ liệu Cước CĐ"
        emptyDescription="Vui lòng chọn ngày báo cáo hoặc tải lên file dữ liệu Cước CĐ để xem báo cáo"
        onRetry={props.onRefresh}
        actionBtnClass={props.surfaceActionBtnClass}
        skeletonStats={0}
        skeletonRows={6}
        skeletonCompact
      >
        <div className={styles.tableWrap}>
          {/* Desktop Table */}
          <table className={styles.table}>
            <thead>
              <tr>
                <th
                  className={`${styles.stickyFirst} ${styles.sortableTh}`}
                  onClick={() => handleHeaderSort("employeeCodeRaw")}
                  role="columnheader"
                  aria-sort={
                    sortField === "employeeCodeRaw"
                      ? sortDirection === "asc"
                        ? "ascending"
                        : "descending"
                      : undefined
                  }
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleHeaderSort("employeeCodeRaw");
                    }
                  }}
                  title="Nhấp để sắp xếp theo User CNKD"
                >
                  <div className={styles.thContent}>
                    <span>User CNKD</span>
                    {renderSortIcon("employeeCodeRaw")}
                  </div>
                </th>
                <th
                  className={styles.sortableTh}
                  onClick={() => handleHeaderSort("dauKy")}
                  role="columnheader"
                  aria-sort={
                    sortField === "dauKy"
                      ? sortDirection === "asc"
                        ? "ascending"
                        : "descending"
                      : undefined
                  }
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleHeaderSort("dauKy");
                    }
                  }}
                  title="Nhấp để sắp xếp theo Đầu kỳ"
                >
                  <div className={styles.thContent}>
                    <span>Đầu kỳ</span>
                    {renderSortIcon("dauKy")}
                  </div>
                </th>
                <th
                  className={styles.sortableTh}
                  onClick={() => handleHeaderSort("luyKe")}
                  role="columnheader"
                  aria-sort={
                    sortField === "luyKe"
                      ? sortDirection === "asc"
                        ? "ascending"
                        : "descending"
                      : undefined
                  }
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleHeaderSort("luyKe");
                    }
                  }}
                  title="Nhấp để sắp xếp theo Lũy kế"
                >
                  <div className={styles.thContent}>
                    <span>Lũy kế</span>
                    {renderSortIcon("luyKe")}
                  </div>
                </th>
                <th
                  className={styles.sortableTh}
                  onClick={() => handleHeaderSort("thuaThieu")}
                  role="columnheader"
                  aria-sort={
                    sortField === "thuaThieu"
                      ? sortDirection === "asc"
                        ? "ascending"
                        : "descending"
                      : undefined
                  }
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleHeaderSort("thuaThieu");
                    }
                  }}
                  title="Nhấp để sắp xếp theo Thuê bao Thừa/Thiếu"
                >
                  <div className={styles.thContent}>
                    <span>Thuê bao Thừa/Thiếu</span>
                    {renderSortIcon("thuaThieu")}
                  </div>
                </th>
                <th
                  className={styles.sortableTh}
                  onClick={() => handleHeaderSort("tonChuaThu")}
                  role="columnheader"
                  aria-sort={
                    sortField === "tonChuaThu"
                      ? sortDirection === "asc"
                        ? "ascending"
                        : "descending"
                      : undefined
                  }
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleHeaderSort("tonChuaThu");
                    }
                  }}
                  title="Nhấp để sắp xếp theo Còn tồn Chưa thu"
                >
                  <div className={styles.thContent}>
                    <span>Còn tồn Chưa thu</span>
                    {renderSortIcon("tonChuaThu")}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {!props.isCtv && props.summaryRow ? renderRow(props.summaryRow, true) : null}
              {displayPagedRows.map((r) => renderRow(r))}
            </tbody>
          </table>

          {/* Mobile Cards */}
          <div className={styles.mobileCards}>
            {!props.isCtv && props.summaryRow ? renderMobileCard(props.summaryRow, true) : null}
            {displayPagedRows.map((r) => renderMobileCard(r))}
          </div>

          {/* Pagination */}
          {filteredRows.length > props.pageSize && (
            <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8, marginTop: 12 }}>
              <button
                className={props.surfacePaginationBtnClass}
                disabled={props.page <= 1}
                onClick={() => props.onPageChange((current) => Math.max(1, current - 1))}
              >
                Trước
              </button>
              <span className={styles.refreshHint}>
                Trang {props.page}/{totalPagesFiltered} (Tổng {filteredRows.length} dòng)
              </span>
              <button
                className={props.surfacePaginationBtnClass}
                disabled={props.page >= totalPagesFiltered}
                onClick={() => props.onPageChange((current) => Math.min(totalPagesFiltered, current + 1))}
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
