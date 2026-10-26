"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Phone,
  RefreshCw,
  Search,
  ShieldAlert,
  Upload,
  Users,
  X,
  MapPin,
  Package,
  FileSpreadsheet,
} from "lucide-react";
import toast from "react-hot-toast";
import AsyncState from "@/components/ui/AsyncState";
import { useDialogAccessibility } from "@/hooks/useDialogAccessibility";
import styles from "./churn-risk.module.css";

interface ChurnRiskRow {
  id: number;
  reportMonth: string;
  ctvCode: string;
  customerName: string;
  phone: string;
  packageName: string;
  address: string;
}

export default function ChurnRiskPage() {
  const { data: session } = useSession();
  const role = session?.user?.role || "";
  const canAdmin = role === "ADMIN";

  const [rows, setRows] = useState<ChurnRiskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [reportMonth, setReportMonth] = useState("");
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Import modal
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importMonth, setImportMonth] = useState("");
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importDialogRef = useDialogAccessibility<HTMLDivElement>({
    enabled: showImportModal,
    closeOnEscape: !importing,
    onClose: () => setShowImportModal(false),
  });

  const hasDataRef = useRef(false);
  const reqRef = useRef(0);

  // Debounce search
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(id);
  }, [search]);

  // Reset page when search or month changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, reportMonth]);

  // Set default import month
  useEffect(() => {
    if (!importMonth) {
      const now = new Date();
      setImportMonth(
        `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
      );
    }
  }, [importMonth]);

  const fetchData = useCallback(
    async (options?: { force?: boolean }) => {
      if (!session?.user) return;
      const hadData = hasDataRef.current;
      const reqId = ++reqRef.current;

      setError(null);
      if (!hadData || options?.force) {
        if (!hadData) setLoading(true);
        else setRefreshing(true);
      }

      try {
        const params = new URLSearchParams();
        if (reportMonth) params.set("reportMonth", reportMonth);
        if (debouncedSearch) params.set("search", debouncedSearch);
        params.set("page", String(page));
        params.set("pageSize", "30");

        const res = await fetch(`/api/churn-risk?${params.toString()}`);
        const data = await res.json();

        if (reqId !== reqRef.current) return;
        if (!res.ok) throw new Error(data?.error || "Không tải được dữ liệu");

        setRows(data.rows || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 0);
        hasDataRef.current = true;

        if (
          Array.isArray(data.availableMonths) &&
          data.availableMonths.length > 0
        ) {
          setAvailableMonths(data.availableMonths);
          if (!reportMonth && data.reportMonth) {
            setReportMonth(data.reportMonth);
          }
        }
      } catch (err: any) {
        if (reqId !== reqRef.current) return;
        const msg = err?.message || "Không tải được dữ liệu";
        setError(msg);
        toast.error(msg);
      } finally {
        if (reqId === reqRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [session?.user, reportMonth, debouncedSearch, page],
  );

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleImport = async () => {
    if (!importFile || !importMonth) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", importFile);
      formData.append("reportMonth", importMonth);

      const res = await fetch("/api/churn-risk/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Import thất bại");

      toast.success(
        `Import nguy cơ rời mạng thành công (${data.inserted} dòng)`,
      );
      setShowImportModal(false);
      setImportFile(null);
      setReportMonth(importMonth);
      await fetchData({ force: true });
    } catch (err: any) {
      toast.error(err?.message || "Import thất bại");
    } finally {
      setImporting(false);
    }
  };

  const formatMonthLabel = (month: string) => {
    if (!month) return "";
    const [y, m] = month.split("-");
    return `Tháng ${parseInt(m, 10)}/${y}`;
  };

  const startIdx = (page - 1) * 30 + 1;

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.headerTitle}>
            <ShieldAlert
              size={22}
              style={{ display: "inline", verticalAlign: "-3px", marginRight: 6, color: "var(--warning)" }}
            />
            Nguy cơ rời mạng
          </h1>
          <p className={styles.headerSubtitle}>
            Danh sách khách hàng có nguy cơ rời mạng
            {reportMonth ? ` — ${formatMonthLabel(reportMonth)}` : ""}
          </p>
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            className="ui-action-btn ui-action-btn--compact"
            onClick={() => fetchData({ force: true })}
            disabled={refreshing}
          >
            <RefreshCw size={15} className={refreshing ? styles.loadingSpinner : ""} />
            Làm mới
          </button>
          {canAdmin && (
            <button
              type="button"
              className="ui-action-btn ui-action-btn--compact ui-action-btn--primary"
              onClick={() => setShowImportModal(true)}
            >
              <Upload size={15} />
              Import
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        <div className={styles.filterItem}>
          <span className={styles.filterLabel}>Kỳ báo cáo</span>
          <select
            className={`${styles.filterInput}`}
            value={reportMonth}
            onChange={(e) => setReportMonth(e.target.value)}
          >
            {availableMonths.length === 0 && reportMonth && (
              <option value={reportMonth}>{formatMonthLabel(reportMonth)}</option>
            )}
            {availableMonths.map((m) => (
              <option key={m} value={m}>
                {formatMonthLabel(m)}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.filterItem} style={{ flex: 1 }}>
          <span className={styles.filterLabel}>Tìm kiếm</span>
          <div style={{ position: "relative" }}>
            <Search
              size={15}
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--secondary-foreground)",
                opacity: 0.5,
              }}
            />
            <input
              type="text"
              className={`${styles.filterInput} ${styles.searchInput}`}
              placeholder="Tên, SĐT, gói cước, địa chỉ, mã NV..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 32, width: "100%" }}
            />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className={styles.statsBar}>
        <span className={styles.statChip}>
          <span className={styles.statChipIcon}>
            <Users size={14} />
          </span>
          {total.toLocaleString("vi-VN")} khách hàng
        </span>
        {total > 0 && (
          <span className={`${styles.statChip} ${styles.statChipWarning}`}>
            <AlertTriangle size={14} />
            Nguy cơ rời mạng
          </span>
        )}
      </div>

      {/* Error */}
      {error && (
        <AsyncState
          compact
          status="error"
          title="Không thể tải dữ liệu rời mạng"
          description={error}
          actionLabel="Thử lại"
          onAction={() => void fetchData({ force: true })}
        />
      )}

      {/* Loading */}
      {loading && (
        <AsyncState compact status="loading" title="Đang tải dữ liệu rời mạng" />
      )}

      {/* Empty */}
      {!loading && !error && rows.length === 0 && (
        <AsyncState
          compact
          status="empty"
          title="Chưa có dữ liệu"
          description={canAdmin
            ? "Hãy import file nguy cơ rời mạng để bắt đầu."
            : "Hiện chưa có dữ liệu nguy cơ rời mạng cho kỳ này."}
        />
      )}

      {/* Table / Cards */}
      {!loading && rows.length > 0 && (
        <div className={refreshing ? styles.refreshOverlay : undefined}>
          {/* Desktop Table */}
          <div className={styles.desktopTable}>
            <div className={styles.tableWrapper}>
              <div className={styles.tableScroll}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th className={styles.colStt}>#</th>
                      <th>Mã NV</th>
                      <th>Tên khách hàng</th>
                      <th>Số điện thoại</th>
                      <th>Gói cước</th>
                      <th>Địa chỉ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => (
                      <tr key={row.id}>
                        <td className={styles.colStt}>{startIdx + idx}</td>
                        <td className={styles.colCtv}>{row.ctvCode}</td>
                        <td className={styles.colName}>{row.customerName}</td>
                        <td className={styles.colPhone}>{row.phone}</td>
                        <td className={styles.colPackage}>
                          <span className={styles.packageBadge}>
                            {row.packageName || "—"}
                          </span>
                        </td>
                        <td className={styles.colAddress}>{row.address}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className={styles.pagination}>
                  <button
                    type="button"
                    className="ui-action-btn ui-action-btn--compact ui-action-btn--pill"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className={styles.pageInfo}>
                    Trang {page} / {totalPages}
                  </span>
                  <button
                    type="button"
                    className="ui-action-btn ui-action-btn--compact ui-action-btn--pill"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Mobile Cards */}
          <div className={styles.mobileCards}>
            {rows.map((row) => (
              <div key={row.id} className={styles.mobileCard}>
                <div className={styles.mobileCardHeader}>
                  <span className={styles.mobileCardName}>
                    {row.customerName || "—"}
                  </span>
                  <span className={styles.mobileCardCtv}>{row.ctvCode}</span>
                </div>
                <div className={styles.mobileCardBody}>
                  <div className={styles.mobileCardRow}>
                    <Phone size={13} style={{ color: "var(--primary)", flexShrink: 0 }} />
                    <span className={styles.mobileCardValue}>{row.phone || "—"}</span>
                  </div>
                  <div className={styles.mobileCardRow}>
                    <Package size={13} style={{ color: "var(--primary)", flexShrink: 0 }} />
                    <span className={styles.packageBadge}>
                      {row.packageName || "—"}
                    </span>
                  </div>
                  {row.address && (
                    <div className={styles.mobileCardAddress}>
                      <MapPin
                        size={12}
                        style={{ display: "inline", verticalAlign: "-2px", marginRight: 4, opacity: 0.6 }}
                      />
                      {row.address}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Mobile Pagination */}
            {totalPages > 1 && (
              <div className={styles.pagination}>
                <button
                  type="button"
                  className="ui-action-btn ui-action-btn--compact ui-action-btn--pill"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeft size={16} />
                </button>
                <span className={styles.pageInfo}>
                  Trang {page} / {totalPages}
                </span>
                <button
                  type="button"
                  className="ui-action-btn ui-action-btn--compact ui-action-btn--pill"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div
          className={styles.importOverlay}
          onMouseDown={(e) => {
            if (!importing && e.target === e.currentTarget) setShowImportModal(false);
          }}
        >
          <div
            ref={importDialogRef}
            className={styles.importModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="churn-import-title"
            tabIndex={-1}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <h3 id="churn-import-title" className={styles.importModalTitle}>Import nguy cơ rời mạng</h3>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="ui-icon-btn"
                aria-label="Đóng hộp thoại import"
                disabled={importing}
              >
                <X size={18} />
              </button>
            </div>

            <div className={styles.importModalField}>
              <span className={styles.filterLabel}>Tháng báo cáo</span>
              <input
                type="month"
                className={styles.filterInput}
                value={importMonth}
                onChange={(e) => setImportMonth(e.target.value)}
                aria-label="Tháng báo cáo"
              />
            </div>

            <div className={styles.importModalField}>
              <span className={styles.filterLabel}>File Excel</span>
              <button
                type="button"
                className={styles.fileDropZone}
                onClick={() => fileInputRef.current?.click()}
                aria-label={importFile ? `Đổi file ${importFile.name}` : "Chọn file Excel để import"}
              >
                {importFile ? (
                  <>
                    <FileSpreadsheet size={28} className={styles.fileDropIcon} />
                    <span className={styles.fileDropName}>{importFile.name}</span>
                    <span className={styles.fileDropText}>
                      Nhấn để đổi file
                    </span>
                  </>
                ) : (
                  <>
                    <Upload size={28} className={styles.fileDropIcon} />
                    <span className={styles.fileDropText}>
                      Nhấn để chọn file .xlsx
                    </span>
                  </>
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className={styles.hiddenInput}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setImportFile(f);
                  e.target.value = "";
                }}
              />
            </div>

            <div className={styles.importModalActions}>
              <button
                type="button"
                className="ui-action-btn ui-action-btn--compact"
                onClick={() => setShowImportModal(false)}
                disabled={importing}
              >
                Hủy
              </button>
              <button
                type="button"
                className="ui-action-btn ui-action-btn--compact ui-action-btn--primary"
                onClick={handleImport}
                disabled={importing || !importFile || !importMonth}
              >
                {importing ? (
                  <>
                    <Loader2 size={15} className={styles.loadingSpinner} />
                    Đang import...
                  </>
                ) : (
                  <>
                    <Upload size={15} />
                    Import
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
