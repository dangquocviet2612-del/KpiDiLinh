"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Download,
  Filter,
  Loader2,
  Trash2,
  Upload,
  User,
} from "lucide-react";
import styles from "./logs.module.css";
import toast from "react-hot-toast";
import { useConfirmDialog } from "@/components/ui/ConfirmDialogProvider";
import AsyncState from "@/components/ui/AsyncState";

type ActionType = "CREATE" | "UPDATE" | string;

interface ChangeValue {
  old: unknown;
  new: unknown;
}

interface ParsedDetails {
  action: ActionType;
  changes?: Record<string, ChangeValue>;
}

interface LogItem {
  id: string;
  createdAt: string;
  details: string;
  user?: { username?: string };
  customer?: { name?: string; account?: string };
}

const surfaceActionBtnClass = "ui-action-btn ui-action-btn--compact";
const surfacePrimaryBtnClass = "ui-action-btn ui-action-btn--compact ui-action-btn--primary";
const surfaceDangerBtnClass = "ui-action-btn ui-action-btn--compact ui-action-btn--danger";
const surfacePaginationBtnClass = "ui-action-btn ui-action-btn--compact ui-action-btn--pill";

function parseDetails(detailsStr: string): ParsedDetails {
  try {
    const parsed = JSON.parse(detailsStr || "{}");
    return {
      action: parsed.action || "UNKNOWN",
      changes: parsed.changes || {},
    };
  } catch {
    return { action: "UNKNOWN", changes: {} };
  }
}

function actionLabel(action: ActionType): string {
  if (action === "CREATE") return "Tạo mới";
  if (action === "UPDATE") return "Cập nhật";
  return action;
}

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "trống";
  return String(value);
}

function riskLevel(log: LogItem): "normal" | "warning" {
  const details = parseDetails(log.details);
  if (details.action === "UPDATE" && details.changes && Object.keys(details.changes).length >= 5) return "warning";
  return "normal";
}

export default function LogsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const confirm = useConfirmDialog();

  const [logs, setLogs] = useState<LogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [actionFilter, setActionFilter] = useState<"ALL" | "CREATE" | "UPDATE">("ALL");
  const [searchText, setSearchText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDownloadingBackup, setIsDownloadingBackup] = useState(false);
  const [isRestoringBackup, setIsRestoringBackup] = useState(false);
  const [backupFile, setBackupFile] = useState<File | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeLog, setActiveLog] = useState<LogItem | null>(null);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated" || (session && session.user.role !== "ADMIN")) {
      router.push("/");
    }
  }, [router, session, status]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);

      const res = await fetch(`/api/logs?${params.toString()}`);
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setLogs(data?.data || []);
        setTotalPages(data?.totalPages || 1);
        setTotal(data?.total || 0);
        setSelectedIds([]);
      } else {
        setLoadError(data?.error || "Không thể tải nhật ký.");
      }
    } catch (error) {
      console.error("Failed to fetch logs:", error);
      setLoadError("Không thể kết nối máy chủ để tải nhật ký.");
    } finally {
      setLoading(false);
    }
  }, [endDate, limit, page, startDate]);

  useEffect(() => {
    if (session?.user?.role === "ADMIN") {
      void fetchLogs();
    }
  }, [fetchLogs, session?.user?.role]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const parsed = parseDetails(log.details);
      if (actionFilter !== "ALL" && parsed.action !== actionFilter) return false;
      if (!searchText.trim()) return true;
      const query = searchText.toLowerCase().trim();
      return (
        (log.user?.username || "").toLowerCase().includes(query) ||
        (log.customer?.name || "").toLowerCase().includes(query) ||
        (log.customer?.account || "").toLowerCase().includes(query)
      );
    });
  }, [actionFilter, logs, searchText]);

  const activeMobileFilterCount = useMemo(() => {
    let count = 0;
    if (startDate) count += 1;
    if (endDate) count += 1;
    if (actionFilter !== "ALL") count += 1;
    if (searchText.trim()) count += 1;
    return count;
  }, [actionFilter, endDate, searchText, startDate]);

  const mobileFilterSummary = useMemo(() => {
    if (searchText.trim()) return `Tìm: ${searchText.trim()}`;
    if (actionFilter !== "ALL") return `Hành động: ${actionLabel(actionFilter)}`;
    if (startDate || endDate) return `${startDate || "--"} → ${endDate || "--"}`;
    return "Tất cả nhật ký";
  }, [actionFilter, endDate, searchText, startDate]);

  const handleDeleteLogs = async () => {
    if (!startDate && !endDate && selectedIds.length === 0) {
      toast.error("Vui lòng chọn log hoặc khoảng ngày cần xóa.");
      return;
    }

    const isBulk = selectedIds.length > 0;
    const confirmMsg = isBulk
      ? `Bạn có chắc muốn xóa ${selectedIds.length} dòng log đã chọn?`
      : "Bạn có chắc muốn xóa toàn bộ log trong khoảng đang lọc?";
    const accepted = await confirm({
      title: isBulk ? `Xóa ${selectedIds.length} nhật ký?` : "Xóa nhật ký theo bộ lọc?",
      description: isBulk ? confirmMsg : `${confirmMsg} Khoảng lọc hiện có ${total.toLocaleString("vi-VN")} bản ghi.`,
      confirmLabel: "Xóa nhật ký",
      destructive: true,
      confirmationText: isBulk ? undefined : "XOA NHAT KY",
    });
    if (!accepted) return;

    setIsDeleting(true);
    try {
      const body = isBulk ? { ids: selectedIds } : { startDate, endDate };
      const res = await fetch("/api/logs", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        toast.success(`Đã xóa ${data?.count ?? 0} bản ghi.`);
        setActiveLog(null);
        setPage(1);
        void fetchLogs();
      } else {
        toast.error(data?.error || "Xóa log thất bại.");
      }
    } catch (error) {
      console.error("Failed to delete logs:", error);
      toast.error("Có lỗi xảy ra khi xóa log.");
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const toggleSelectAllOnCurrentFilteredList = () => {
    if (selectedIds.length === filteredLogs.length && filteredLogs.length > 0) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(filteredLogs.map((item) => item.id));
  };

  const handleDownloadBackup = async () => {
    setIsDownloadingBackup(true);
    try {
      const res = await fetch("/api/admin/backup");
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error || "Không thể tải file backup.");
        return;
      }

      const blob = await res.blob();
      const disposition = res.headers.get("content-disposition") || "";
      const matched = disposition.match(/filename="(.+)"/);
      const filename = matched?.[1] || "backup.json";

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success("Tải backup thành công.");
    } catch (error) {
      console.error("Failed to download backup:", error);
      toast.error("Có lỗi khi tải backup.");
    } finally {
      setIsDownloadingBackup(false);
    }
  };

  const handleRestoreBackup = async () => {
    if (!backupFile) {
      toast.error("Vui lòng chọn file backup JSON.");
      return;
    }

    const confirmed = await confirm({
      title: "Khôi phục toàn bộ dữ liệu?",
      description: "File backup sẽ ghi đè dữ liệu hiện tại. Hành động này có rủi ro cao và không thể hoàn tác tự động.",
      confirmLabel: "Khôi phục dữ liệu",
      destructive: true,
      details: <strong>{backupFile.name}</strong>,
      confirmationText: "KHOI PHUC",
    });
    if (!confirmed) return;

    setIsRestoringBackup(true);
    try {
      const text = await backupFile.text();
      const payload = JSON.parse(text);
      const res = await fetch("/api/admin/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        toast.error(data?.error || "Khôi phục dữ liệu thất bại.");
        return;
      }

      setBackupFile(null);
      setPage(1);
      void fetchLogs();
      toast.success(`Khôi phục thành công: ${data?.restored?.customers ?? 0} khách hàng, ${data?.restored?.users ?? 0} người dùng.`, { duration: 5000 });
    } catch (error) {
      console.error("Failed to restore backup:", error);
      toast.error("File không hợp lệ hoặc có lỗi khi khôi phục.");
    } finally {
      setIsRestoringBackup(false);
    }
  };

  if (status === "loading" || (session && session.user.role !== "ADMIN")) {
    return <AsyncState status="loading" title="Đang kiểm tra quyền truy cập" />;
  }

  const activeDetails = activeLog ? parseDetails(activeLog.details) : null;

  return (
    <div className={styles.container}>
      <div className={`${styles.panel} ${styles.topBar}`}>
        <div className="ui-panel-heading">
          <h1 className={`${styles.title} ui-panel-title`}>Nhật ký CTV</h1>
          <p className={`${styles.subtitle} ui-panel-subtitle`}>
            Theo dõi thao tác theo dòng thời gian, lọc nhanh và xem chi tiết thay đổi.
          </p>
        </div>
        <div className={`${styles.kpi} ui-badge ui-badge--neutral`}>
          Tổng bản ghi: <strong>{total}</strong>
        </div>
      </div>

      <div className={`${styles.panel} ${styles.desktopFilterPanel}`}>
        <div className={styles.filterRow}>
          <div className={styles.filterItem}>
            <label>Từ ngày</label>
            <input type="date" className="input-base" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </div>
          <div className={styles.filterItem}>
            <label>Đến ngày</label>
            <input type="date" className="input-base" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </div>
          <div className={styles.filterItem}>
            <label>Hành động</label>
            <select className="input-base" value={actionFilter} onChange={(event) => setActionFilter(event.target.value as "ALL" | "CREATE" | "UPDATE")}>
              <option value="ALL">Tất cả</option>
              <option value="CREATE">Tạo mới</option>
              <option value="UPDATE">Cập nhật</option>
            </select>
          </div>
          <div className={styles.filterItemGrow}>
            <label>Tìm nhanh</label>
            <input
              type="text"
              className="input-base"
              placeholder="Tên khách, account, CTV..."
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
            />
          </div>
        </div>
        <div className={styles.actions}>
          <button className={surfaceActionBtnClass} onClick={() => { setPage(1); void fetchLogs(); }} disabled={loading}>
            <Filter size={16} />
            Lọc
          </button>
          <button
            className={surfaceDangerBtnClass}
            onClick={handleDeleteLogs}
            disabled={isDeleting || loading || (!startDate && !endDate && selectedIds.length === 0)}
          >
            {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
            {selectedIds.length > 0 ? `Xóa ${selectedIds.length} dòng` : "Xóa theo bộ lọc"}
          </button>
        </div>
      </div>

      <div className={`${styles.panel} ${styles.mobileFilterPanel}`}>
        <div className={styles.mobileFilterSummary}>
          <div className={styles.mobileFilterInfo}>
            <span className={styles.mobileFilterLabel}>
              {activeMobileFilterCount > 0 ? `Bộ lọc (${activeMobileFilterCount})` : "Bộ lọc nhật ký"}
            </span>
            <strong>{mobileFilterSummary}</strong>
          </div>
          <button
            type="button"
            className={surfaceActionBtnClass}
            onClick={() => setShowMobileFilters((prev) => !prev)}
            aria-expanded={showMobileFilters}
          >
            <Filter size={16} />
            {showMobileFilters ? "Ẩn" : "Mở"}
            {showMobileFilters ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
        {showMobileFilters ? (
          <div className={styles.mobileFilterFields}>
            <div className={styles.filterRow}>
              <div className={styles.filterItem}>
                <label>Từ ngày</label>
                <input type="date" className="input-base" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
              </div>
              <div className={styles.filterItem}>
                <label>Đến ngày</label>
                <input type="date" className="input-base" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
              </div>
              <div className={styles.filterItem}>
                <label>Hành động</label>
                <select className="input-base" value={actionFilter} onChange={(event) => setActionFilter(event.target.value as "ALL" | "CREATE" | "UPDATE")}>
                  <option value="ALL">Tất cả</option>
                  <option value="CREATE">Tạo mới</option>
                  <option value="UPDATE">Cập nhật</option>
                </select>
              </div>
              <div className={styles.filterItemGrow}>
                <label>Tìm nhanh</label>
                <input
                  type="text"
                  className="input-base"
                  placeholder="Tên khách, account, CTV..."
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                />
              </div>
            </div>
            <div className={styles.actions}>
              <button className={surfaceActionBtnClass} onClick={() => { setPage(1); void fetchLogs(); }} disabled={loading}>
                <Filter size={16} />
                Lọc
              </button>
              <button
                className={surfaceDangerBtnClass}
                onClick={handleDeleteLogs}
                disabled={isDeleting || loading || (!startDate && !endDate && selectedIds.length === 0)}
              >
                {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                {selectedIds.length > 0 ? `Xóa ${selectedIds.length} dòng` : "Xóa theo bộ lọc"}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className={`${styles.panel} ${styles.backupPanel}`}>
        <div className={styles.backupTop}>
          <div className="ui-panel-heading">
            <h3 className="ui-panel-title">Backup & Restore dữ liệu</h3>
            <p className="ui-panel-subtitle">Admin có thể tải file backup JSON và khôi phục khi web gặp sự cố.</p>
          </div>
          <button className={surfacePrimaryBtnClass} onClick={handleDownloadBackup} disabled={isDownloadingBackup}>
            {isDownloadingBackup ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            Tải backup
          </button>
        </div>
        <div className={styles.backupBottom}>
          <input
            type="file"
            accept="application/json,.json"
            className="input-base"
            onChange={(event) => setBackupFile(event.target.files?.[0] || null)}
          />
          <button className={surfaceDangerBtnClass} onClick={handleRestoreBackup} disabled={isRestoringBackup || !backupFile}>
            {isRestoringBackup ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            Khôi phục dữ liệu
          </button>
        </div>
        {backupFile ? <div className={styles.fileHint}>Đã chọn: {backupFile.name}</div> : null}
      </div>

      <div className={styles.layout}>
        <div className={styles.panel}>
          <div className={styles.timelineHeader}>
            <button
              className={`ui-action-btn ui-action-btn--compact ui-action-btn--pill ${styles.selectAll}`}
              onClick={toggleSelectAllOnCurrentFilteredList}
            >
              {selectedIds.length === filteredLogs.length && filteredLogs.length > 0 ? "Bỏ chọn tất cả" : "Chọn tất cả trang này"}
            </button>
            <span>{filteredLogs.length} dòng trên trang</span>
          </div>

          {loading ? (
            <AsyncState compact status="loading" title="Đang tải nhật ký" />
          ) : loadError ? (
            <AsyncState
              compact
              status="error"
              title="Không thể tải nhật ký"
              description={loadError}
              actionLabel="Thử lại"
              onAction={() => void fetchLogs()}
            />
          ) : filteredLogs.length === 0 ? (
            <AsyncState
              compact
              status="empty"
              title="Không có nhật ký phù hợp"
              description="Hãy thay đổi từ khóa, hành động hoặc khoảng ngày."
            />
          ) : (
            <div className={styles.timelineList}>
              {filteredLogs.map((log) => {
                const parsed = parseDetails(log.details);
                const isSelected = selectedIds.includes(log.id);
                const isActive = activeLog?.id === log.id;
                return (
                  <div
                    key={log.id}
                    className={`${styles.timelineItem} ${isActive ? styles.activeItem : ""}`}
                    onClick={() => setActiveLog(log)}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(event) => {
                        event.stopPropagation();
                        toggleSelected(log.id);
                      }}
                    />
                    <div className={styles.timelineDot} data-risk={riskLevel(log)} />
                    <div className={styles.timelineContent}>
                      <div className={styles.timelineTop}>
                        <span className={`${styles.actionBadge} ui-badge`} data-action={parsed.action}>
                          {actionLabel(parsed.action)}
                        </span>
                        <span className={styles.timeLabel}>
                          <CalendarDays size={14} />
                          {new Date(log.createdAt).toLocaleString("vi-VN")}
                        </span>
                      </div>
                      <div className={styles.mainText}>
                        <strong>{log.user?.username || "N/A"}</strong> tác động lên <strong>{log.customer?.name || "N/A"}</strong>
                        <span className={styles.accountText}> ({log.customer?.account || "---"})</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {totalPages > 1 ? (
            <div className={styles.pagination}>
              <div className={styles.pageControls}>
                <button className={surfacePaginationBtnClass} disabled={page === 1} onClick={() => setPage((prev) => prev - 1)}>
                  <ChevronLeft size={16} />
                  Trước
                </button>
                <span>
                  Trang {page}/{totalPages}
                </span>
                <button className={surfacePaginationBtnClass} disabled={page === totalPages} onClick={() => setPage((prev) => prev + 1)}>
                  Sau
                  <ChevronRight size={16} />
                </button>
              </div>
              <select
                className="input-base"
                value={limit}
                onChange={(event) => {
                  setLimit(Number(event.target.value));
                  setPage(1);
                }}
              >
                <option value={10}>10 dòng</option>
                <option value={20}>20 dòng</option>
                <option value={50}>50 dòng</option>
                <option value={100}>100 dòng</option>
              </select>
            </div>
          ) : null}
        </div>

        <div className={styles.panel}>
          {activeLog ? (
            <>
              <div className={styles.detailHeader}>
                <h3>Chi tiết thao tác</h3>
                <span>{new Date(activeLog.createdAt).toLocaleString("vi-VN")}</span>
              </div>
              <div className={styles.detailMeta}>
                <div>
                  <User size={14} />
                  {activeLog.user?.username || "N/A"}
                </div>
                <div>
                  KH: <strong>{activeLog.customer?.name || "N/A"}</strong>
                </div>
                <div>
                  Account: <strong>{activeLog.customer?.account || "---"}</strong>
                </div>
              </div>

              {activeDetails?.action === "CREATE" ? (
                <div className={styles.createBox}>Tạo mới toàn bộ dữ liệu khách hàng.</div>
              ) : (
                <div className={styles.diffBox}>
                  {Object.entries(activeDetails?.changes || {}).length === 0 ? (
                    <p>Không có thay đổi chi tiết.</p>
                  ) : (
                    Object.entries(activeDetails?.changes || {}).map(([field, value]) => (
                      <div key={field} className={styles.diffRow}>
                        <span className={styles.diffField}>{field}</span>
                        <span className={styles.diffOld}>{stringifyValue((value as ChangeValue).old)}</span>
                        <span className={styles.diffArrow}>→</span>
                        <span className={styles.diffNew}>{stringifyValue((value as ChangeValue).new)}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          ) : (
            <div className={styles.centerState}>Chọn một dòng nhật ký để xem chi tiết.</div>
          )}
        </div>
      </div>
    </div>
  );
}
