"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { useConfirmDialog } from "@/components/ui/ConfirmDialogProvider";
import AsyncState from "@/components/ui/AsyncState";
import styles from "./archive.module.css";

type ArchiveRecord = {
  id: number;
  archiveMonth: string;
  archivedBy: string;
  archivedAt: string;
  purgeAfter: string;
  purgedAt: string | null;
  kpiRecordCount: number;
  cuocRecordCount: number;
  fileName: string | null;
};

type ArchiveExportRecord = {
  id: number;
  archiveMonth: string;
  exportedBy: string;
  exportedAt: string;
  fileName: string;
};

type StatusResponse = {
  month: string;
  kpiCount: number;
  cuocCount: number;
  archive: ArchiveRecord | null;
  exportLog: ArchiveExportRecord | null;
  exportFresh: boolean;
  confirmBlockedReason: "no_data" | "no_export" | "stale_export" | null;
  latestDataAt: string | null;
  canArchive: boolean;
  canConfirm: boolean;
};

const surfaceActionBtnClass = "ui-action-btn ui-action-btn--compact";
const surfacePrimaryBtnClass =
  "ui-action-btn ui-action-btn--compact ui-action-btn--primary";
const surfaceDangerBtnClass =
  "ui-action-btn ui-action-btn--compact ui-action-btn--danger";

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const raw = String(value).trim();
  const normalized = raw.includes("T") ? raw : `${raw.replace(" ", "T")}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("vi-VN");
}

function buildMonthOptions(totalMonths = 24) {
  const now = new Date();
  const items: string[] = [];
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  for (let i = 1; i <= totalMonths; i += 1) {
    const date = new Date(
      currentMonthStart.getFullYear(),
      currentMonthStart.getMonth() - i,
      1
    );
    items.push(
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
    );
  }
  return items;
}

function formatMonthLabel(month: string) {
  const [year, rawMonth] = month.split("-");
  return `Tháng ${Number(rawMonth)}/${year}`;
}

function buildConfirmHint(reason: StatusResponse["confirmBlockedReason"]) {
  if (reason === "no_export") {
    return "Cần xuất file Excel mới trước khi xác nhận lưu trữ.";
  }
  if (reason === "stale_export") {
    return "Dữ liệu đã thay đổi sau lần xuất gần nhất. Hãy xuất Excel lại trước khi xác nhận.";
  }
  if (reason === "no_data") {
    return "Không có dữ liệu KPI/Cước cho tháng đã chọn.";
  }
  return "";
}

export default function ArchivePage() {
  const { data: session, status } = useSession();
  const confirm = useConfirmDialog();
  const role = session?.user?.role || "";
  const isAdmin = role === "ADMIN";

  const monthOptions = useMemo(() => buildMonthOptions(36), []);
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0] || "");
  const [data, setData] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [busyAction, setBusyAction] = useState("");

  const loadStatus = useCallback(async () => {
    if (!selectedMonth || !isAdmin) return;
    setLoading(true);
    setLoadError("");
    setData(null);
    try {
      const res = await fetch(
        `/api/archive/status?month=${encodeURIComponent(selectedMonth)}`
      );
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error || "Tải trạng thái lưu trữ thất bại");
      }
      setData(payload);
    } catch (error: any) {
      const message = error.message || "Tải trạng thái lưu trữ thất bại";
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, selectedMonth]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleExport = async () => {
    if (!selectedMonth) return;
    setBusyAction("export");
    try {
      const res = await fetch(
        `/api/archive/export?month=${encodeURIComponent(selectedMonth)}`,
        { method: "POST" }
      );
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error || "Xuất file Excel thất bại");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `archive_kpi_cuoc_${selectedMonth}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      await loadStatus();
      toast.success("Đã tải file Excel thành công");
    } catch (error: any) {
      toast.error(error.message || "Xuất file Excel thất bại");
    } finally {
      setBusyAction("");
    }
  };

  const handleArchiveAction = async (action: "confirm" | "cancel" | "purge") => {
    if (!selectedMonth) return;

    if (action === "purge") {
      const accepted = await confirm({
        title: `Xóa dữ liệu ${formatMonthLabel(selectedMonth)}?`,
        description: `Hành động này xóa vĩnh viễn ${totalRecords.toLocaleString("vi-VN")} bản ghi KPI/Cước. Chỉ tiếp tục khi bạn đã tải file Excel backup mới nhất.`,
        confirmLabel: "Xóa vĩnh viễn",
        destructive: true,
        confirmationText: selectedMonth,
      });
      if (!accepted) return;
    }

    if (action === "confirm") {
      const accepted = await confirm({
        title: `Xác nhận lưu trữ ${formatMonthLabel(selectedMonth)}?`,
        description: "Sau 2 ngày, dữ liệu sẽ được xóa khi tác vụ purge đến hạn. Hãy đảm bảo file Excel mới nhất đã được xuất.",
        confirmLabel: "Đã lưu trữ",
      });
      if (!accepted) return;
    }

    setBusyAction(action);
    try {
      const res = await fetch(`/api/archive/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: selectedMonth }),
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error || "Thao tác lưu trữ thất bại");
      }

      if (action === "confirm") {
        toast.success("Đã xác nhận lưu trữ thành công");
      } else if (action === "cancel") {
        toast.success("Đã hủy xác nhận lưu trữ");
      } else {
        toast.success("Đã xóa dữ liệu thành công");
      }

      await loadStatus();
    } catch (error: any) {
      toast.error(error.message || "Thao tác lưu trữ thất bại");
    } finally {
      setBusyAction("");
    }
  };

  const handleRunDuePurge = async () => {
    setBusyAction("purge-due");
    try {
      const res = await fetch("/api/archive/purge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error || "Không thể kiểm tra dữ liệu đến hạn purge");
      }

      const count = Number(payload?.count || 0);
      toast.success(
        count > 0
          ? `Đã purge ${count} tháng đến hạn`
          : "Không có tháng nào đến hạn purge"
      );
      await loadStatus();
    } catch (error: any) {
      toast.error(error.message || "Không thể kiểm tra dữ liệu đến hạn purge");
    } finally {
      setBusyAction("");
    }
  };

  if (status === "loading") {
    return <AsyncState status="loading" title="Đang kiểm tra quyền lưu trữ" />;
  }

  if (!isAdmin) {
    return (
      <AsyncState
        status="info"
        title="Bạn không có quyền truy cập"
        description="Chỉ ADMIN được phép truy cập màn hình lưu trữ dữ liệu."
      />
    );
  }

  if (!data) {
    return loadError ? (
      <AsyncState
        status="error"
        title="Không thể tải trạng thái lưu trữ"
        description={loadError}
        actionLabel="Thử lại"
        onAction={() => void loadStatus()}
      />
    ) : (
      <AsyncState status="loading" title="Đang tải dữ liệu lưu trữ" />
    );
  }

  const totalRecords = (data?.kpiCount ?? 0) + (data?.cuocCount ?? 0);
  const isPurged = Boolean(data?.archive?.purgedAt);
  const isConfirmed = Boolean(data?.archive) && !isPurged;
  const confirmHint = buildConfirmHint(data?.confirmBlockedReason || null);

  return (
    <div className={styles.container}>
      <div className={`${styles.header} ui-panel-heading`}>
        <h1 className="ui-panel-title">Lưu trữ dữ liệu KPI/Cước</h1>
        <p className="ui-panel-subtitle">
          Xuất dữ liệu KPI và Cước theo tháng, xác nhận lưu trữ rồi để hệ thống
          dọn bớt dữ liệu cũ một cách an toàn.
        </p>
      </div>

      <section className={`glass-panel ${styles.panel}`}>
        <div className="ui-panel-heading">
          <h2 className="ui-panel-title">Xuất và xác nhận lưu trữ</h2>
          <p className="ui-panel-subtitle">
            Chọn tháng cần xử lý, xuất file Excel mới nhất rồi mới xác nhận lưu
            trữ.
          </p>
        </div>

        <div className={styles.controls}>
          <label className={styles.field}>
            <span>Tháng lưu trữ</span>
            <select
              className="input-base"
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
            >
              {monthOptions.map((month) => (
                <option key={month} value={month}>
                  {formatMonthLabel(month)}
                </option>
              ))}
            </select>
          </label>

          <button
            className={surfaceActionBtnClass}
            onClick={loadStatus}
            disabled={loading || busyAction !== ""}
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : "Làm mới"}
          </button>
        </div>

        {loadError && (
          <AsyncState
            compact
            status="error"
            title="Không thể làm mới trạng thái"
            description={loadError}
            actionLabel="Thử lại"
            onAction={() => void loadStatus()}
          />
        )}

        <div className={styles.counts}>
          <div className={styles.card}>
            <span>Bản ghi KPI</span>
            <strong>{(data?.kpiCount ?? 0).toLocaleString("vi-VN")}</strong>
          </div>
          <div className={styles.card}>
            <span>Bản ghi Cước</span>
            <strong>{(data?.cuocCount ?? 0).toLocaleString("vi-VN")}</strong>
          </div>
          <div className={styles.card}>
            <span>Tổng cộng</span>
            <strong>{totalRecords.toLocaleString("vi-VN")}</strong>
          </div>
        </div>

        <div className={styles.exportStatusCard}>
          <div className={styles.exportStatusHeader}>
            <div>
              <span className={styles.exportStatusLabel}>
                Lần xuất Excel gần nhất
              </span>
              <strong>
                {data?.exportLog
                  ? formatDateTime(data.exportLog.exportedAt)
                  : "Chưa xuất file"}
              </strong>
            </div>
            <span
              className={`ui-badge ${styles.exportStatusBadge} ${
                data?.exportFresh ? styles.exportStatusFresh : styles.exportStatusStale
              }`}
            >
              {data?.exportFresh ? "Bản xuất hiện tại" : "Cần xuất lại"}
            </span>
          </div>

          <div className={styles.exportStatusMeta}>
            <span>Người xuất: {data?.exportLog?.exportedBy || "-"}</span>
            <span>File: {data?.exportLog?.fileName || "-"}</span>
            <span>Dữ liệu gần nhất: {formatDateTime(data?.latestDataAt)}</span>
          </div>
        </div>

        {!!confirmHint && !isConfirmed && !isPurged && (
          <div className={styles.infoBox}>{confirmHint}</div>
        )}

        {totalRecords > 0 && !isPurged && (
          <div className={styles.warning}>
            <strong>Lưu ý:</strong> sau khi dữ liệu bị purge, bản ghi KPI/Cước
            của tháng này sẽ bị xóa khỏi database. File Excel đã xuất là bản
            backup để đối chiếu về sau.
          </div>
        )}

        {isPurged && (
          <div className={styles.successBox}>
            Dữ liệu {formatMonthLabel(selectedMonth)} đã được xóa thành công.
          </div>
        )}

        <div className={styles.actions}>
          <button
            className={surfacePrimaryBtnClass}
            onClick={handleExport}
            disabled={busyAction !== "" || totalRecords === 0}
          >
            Xuất Excel
          </button>

          {!isConfirmed && !isPurged && (
            <button
              className={surfaceActionBtnClass}
              onClick={() => handleArchiveAction("confirm")}
              disabled={busyAction !== "" || !data?.canConfirm || totalRecords === 0}
            >
              Xác nhận đã lưu
            </button>
          )}

          {isConfirmed && (
            <>
              <button
                className={surfaceActionBtnClass}
                onClick={() => handleArchiveAction("cancel")}
                disabled={busyAction !== ""}
              >
                Hủy xác nhận
              </button>
              <button
                className={surfaceDangerBtnClass}
                onClick={() => handleArchiveAction("purge")}
                disabled={busyAction !== ""}
              >
                Xóa dữ liệu ngay
              </button>
            </>
          )}

          <button
            className={surfaceActionBtnClass}
            onClick={handleRunDuePurge}
            disabled={busyAction !== ""}
          >
            Kiểm tra đến hạn
          </button>
        </div>

        {busyAction && (
          <div className={styles.loading}>
            <Loader2 size={18} className="animate-spin" />
            Đang xử lý...
          </div>
        )}
      </section>

      {data?.archive && (
        <section className={`glass-panel ${styles.panel}`}>
          <div className="ui-panel-heading">
            <h2 className="ui-panel-title">Trạng thái lưu trữ</h2>
            <p className="ui-panel-subtitle">
              Theo dõi thời điểm xác nhận, lịch purge và số lượng bản ghi đã lưu.
            </p>
          </div>

          <div className={styles.statusGrid}>
            <div>
              <span>Người xác nhận</span>
              <strong>{data.archive.archivedBy}</strong>
            </div>
            <div>
              <span>Đã xác nhận lúc</span>
              <strong>{formatDateTime(data.archive.archivedAt)}</strong>
            </div>
            <div>
              <span>Sẽ tự xóa sau</span>
              <strong>{formatDateTime(data.archive.purgeAfter)}</strong>
            </div>
            <div>
              <span>Đã xóa lúc</span>
              <strong>
                {data.archive.purgedAt
                  ? formatDateTime(data.archive.purgedAt)
                  : "Chưa xóa"}
              </strong>
            </div>
            <div>
              <span>Số bản ghi KPI đã lưu</span>
              <strong>
                {(data.archive.kpiRecordCount ?? 0).toLocaleString("vi-VN")}
              </strong>
            </div>
            <div>
              <span>Số bản ghi Cước đã lưu</span>
              <strong>
                {(data.archive.cuocRecordCount ?? 0).toLocaleString("vi-VN")}
              </strong>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
