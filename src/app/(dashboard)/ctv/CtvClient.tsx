"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Edit, Loader2, MapPin, Plus, RotateCcw, Save, Search, ShieldCheck, Trash2, Users } from "lucide-react";
import CtvModal from "@/components/CtvModal";
import toast from "react-hot-toast";
import { useConfirmDialog } from "@/components/ui/ConfirmDialogProvider";
import AsyncState from "@/components/ui/AsyncState";
import ctvStyles from "./ctv.module.css";

type UserRow = {
  id: string | number;
  username: string;
  role: string;
  secondaryCode?: string | null;
  managerCode?: string | null;
  canUseGps?: boolean;
  createdAt: string;
};

type KpiConfigRow = {
  kpiCode: string;
  displayName?: string | null;
  mergeGroup?: string | null;
  baseScore: number | string;
  maxPercent: number | string;
  isEnabled: number | boolean;
  isNegative?: number | boolean;
};

type KpiRowErrors = {
  baseScore?: string;
  maxPercent?: string;
};

type KpiRowSaveState = {
  status: "saving" | "success" | "error";
  message?: string;
};

type KpiEffectiveGroupInfo = {
  effectiveBaseScore: number;
  effectiveMaxScore: number;
  memberCount: number;
};

const compactActionBtn = "ui-action-btn ui-action-btn--compact ui-action-btn--pill";
const compactDangerBtn = "ui-action-btn ui-action-btn--compact ui-action-btn--pill ui-action-btn--danger";
const pointFormatter = new Intl.NumberFormat("vi-VN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function toNumericValue(value: unknown) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function normalizeComparableValue(value: number | string) {
  if (String(value).trim() === "") return "";
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : String(value);
}

function areKpiRowsEqual(left: KpiConfigRow, right?: KpiConfigRow) {
  if (!right) return false;
  return (
    String(left.displayName || "") === String(right.displayName || "") &&
    String(left.mergeGroup || "") === String(right.mergeGroup || "") &&
    normalizeComparableValue(left.baseScore) === normalizeComparableValue(right.baseScore) &&
    normalizeComparableValue(left.maxPercent) === normalizeComparableValue(right.maxPercent) &&
    Number(left.isEnabled) === Number(right.isEnabled) &&
    Number(left.isNegative || 0) === Number(right.isNegative || 0)
  );
}

function validateKpiRow(row: KpiConfigRow): KpiRowErrors {
  const errors: KpiRowErrors = {};
  if (String(row.baseScore).trim() === "") {
    errors.baseScore = "Điểm chuẩn là bắt buộc";
  } else if (!Number.isFinite(Number(row.baseScore))) {
    errors.baseScore = "Điểm chuẩn phải là một số hợp lệ";
  }

  if (String(row.maxPercent).trim() === "") {
    errors.maxPercent = "% tối đa là bắt buộc";
  } else if (!Number.isFinite(Number(row.maxPercent))) {
    errors.maxPercent = "% tối đa phải là một số hợp lệ";
  }
  return errors;
}

export default function CtvClient({ view = "" }: { view?: string }) {
  const isKpiConfigView = view === "kpi-config";
  const confirm = useConfirmDialog();
  const router = useRouter();

  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);

  const [kpiConfigs, setKpiConfigs] = useState<KpiConfigRow[]>([]);
  const [savedKpiConfigs, setSavedKpiConfigs] = useState<KpiConfigRow[]>([]);
  const [kpiLoading, setKpiLoading] = useState(false);
  const [kpiLoadError, setKpiLoadError] = useState("");
  const [savingAll, setSavingAll] = useState(false);
  const [rowSaveStates, setRowSaveStates] = useState<Record<string, KpiRowSaveState>>({});

  const navClassName = (active: boolean) =>
    `${ctvStyles.segmentedLink} ${active ? ctvStyles.segmentedLinkActive : ""}`;

  const fetchUsers = async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const data = await res.json();
        setUsers((data || []).filter((user: UserRow) => user.role !== "ADMIN"));
      } else {
        const data = await res.json().catch(() => null);
        setLoadError(data?.error || "Không tải được danh sách CTV");
      }
    } catch {
      setLoadError("Không tải được danh sách CTV");
    } finally {
      setLoading(false);
    }
  };

  const fetchKpiConfig = async () => {
    setKpiLoading(true);
    setKpiLoadError("");
    try {
      const res = await fetch("/api/kpi/config");
      if (res.ok) {
        const data = await res.json();
        const rows = Array.isArray(data) ? data : [];
        setKpiConfigs(rows);
        setSavedKpiConfigs(rows.map((row) => ({ ...row })));
        setRowSaveStates({});
      } else {
        const data = await res.json().catch(() => null);
        const message = data?.error || "Không tải được cấu hình KPI";
        setKpiLoadError(message);
        toast.error(message);
      }
    } catch {
      const message = "Không tải được cấu hình KPI";
      setKpiLoadError(message);
      toast.error(message);
    } finally {
      setKpiLoading(false);
    }
  };

  const updateKpiRow = (kpiCode: string, patch: Partial<KpiConfigRow>) => {
    setKpiConfigs((prev) => prev.map((row) => (row.kpiCode === kpiCode ? { ...row, ...patch } : row)));
    setRowSaveStates((prev) => {
      if (!prev[kpiCode]) return prev;
      const next = { ...prev };
      delete next[kpiCode];
      return next;
    });
  };

  const saveAllKpiConfigs = async () => {
    const savedByCode = new Map(savedKpiConfigs.map((row) => [row.kpiCode, row]));
    const dirtyRows = kpiConfigs.filter((row) => !areKpiRowsEqual(row, savedByCode.get(row.kpiCode)));
    const invalidRows = dirtyRows.filter((row) => Object.keys(validateKpiRow(row)).length > 0);
    if (invalidRows.length > 0) {
      toast.error(`Còn ${invalidRows.length} dòng cần kiểm tra trước khi lưu.`);
      return;
    }
    if (dirtyRows.length === 0) return;

    setSavingAll(true);
    setRowSaveStates((prev) => {
      const next = { ...prev };
      dirtyRows.forEach((row) => {
        next[row.kpiCode] = { status: "saving" };
      });
      return next;
    });

    const results = await Promise.all(dirtyRows.map(async (row) => {
      try {
        const res = await fetch("/api/kpi/config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...row,
            baseScore: Number(row.baseScore),
            maxPercent: Number(row.maxPercent),
            isEnabled: Number(row.isEnabled) === 1,
            isNegative: Number(row.isNegative) === 1,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error || `Lưu thất bại: ${row.kpiCode}`);
        }
        return { row, ok: true as const };
      } catch (error) {
        return {
          row,
          ok: false as const,
          message: error instanceof Error ? error.message : `Lưu thất bại: ${row.kpiCode}`,
        };
      }
    }));

    const successfulRows = results.filter((result) => result.ok).map((result) => result.row);
    const failedRows = results.filter((result) => !result.ok);

    if (successfulRows.length > 0) {
      const successfulByCode = new Map(successfulRows.map((row) => [row.kpiCode, row]));
      setSavedKpiConfigs((prev) => prev.map((row) => {
        const savedRow = successfulByCode.get(row.kpiCode);
        return savedRow ? { ...savedRow } : row;
      }));
    }

    setRowSaveStates((prev) => {
      const next = { ...prev };
      results.forEach((result) => {
        next[result.row.kpiCode] = result.ok
          ? { status: "success" }
          : { status: "error", message: result.message };
      });
      return next;
    });
    setSavingAll(false);

    if (failedRows.length === 0) {
      toast.success(`Đã lưu ${successfulRows.length} dòng cấu hình KPI.`);
    } else {
      toast.error(`Đã lưu ${successfulRows.length} dòng, còn ${failedRows.length} dòng lỗi.`);
    }
  };

  useEffect(() => {
    if (isKpiConfigView) {
      void fetchKpiConfig();
    } else {
      void fetchUsers();
    }
  }, [isKpiConfigView]);

  const handleDelete = async (user: UserRow) => {
    const accepted = await confirm({
      title: `Xóa CTV “${user.username}”?`,
      description: "Tài khoản CTV sẽ không thể đăng nhập sau khi bị xóa.",
      confirmLabel: "Xóa CTV",
      destructive: true,
      details: (
        <ul className={ctvStyles.deleteImpact}>
          <li>{`Vai trò: ${user.role === "MANAGER" ? "Quản lý" : "CTV"}`}</li>
          <li>{`Quản lý trực tiếp: ${user.managerCode || "Chưa gán"}`}</li>
          <li>{`Mã phụ KPI: ${user.secondaryCode || "Chưa có"}`}</li>
          <li>{`Quyền GPS: ${user.canUseGps ? "đang bật" : "đang tắt"}`}</li>
        </ul>
      ),
    });
    if (!accepted) return;

    try {
      const res = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
      if (res.ok) {
        void fetchUsers();
        toast.success("Đã xóa CTV.");
      } else {
        const data = await res.json().catch(() => null);
        toast.error(data?.error || "Xóa thất bại");
      }
    } catch {
      toast.error("Lỗi khi xóa");
    }
  };

  const filteredUsers = useMemo(
    () => users.filter((user) => user.username.toLowerCase().includes(searchQuery.toLowerCase())),
    [users, searchQuery],
  );

  const savedKpiByCode = useMemo(
    () => new Map(savedKpiConfigs.map((row) => [row.kpiCode, row])),
    [savedKpiConfigs],
  );
  const dirtyKpiCodes = useMemo(
    () => new Set(
      kpiConfigs
        .filter((row) => !areKpiRowsEqual(row, savedKpiByCode.get(row.kpiCode)))
        .map((row) => row.kpiCode),
    ),
    [kpiConfigs, savedKpiByCode],
  );
  const validationByCode = useMemo(
    () => new Map(kpiConfigs.map((row) => [row.kpiCode, validateKpiRow(row)])),
    [kpiConfigs],
  );
  const dirtyCount = dirtyKpiCodes.size;
  const invalidDirtyCount = Array.from(dirtyKpiCodes).filter(
    (kpiCode) => Object.keys(validationByCode.get(kpiCode) || {}).length > 0,
  ).length;

  useEffect(() => {
    if (!isKpiConfigView || dirtyCount === 0) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const handleNavigationClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const target = event.target as Element | null;
      const anchor = target?.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      const destination = new URL(anchor.href, window.location.href);
      const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      const nextPath = `${destination.pathname}${destination.search}${destination.hash}`;
      if (destination.origin !== window.location.origin || nextPath === currentPath) return;

      event.preventDefault();
      void confirm({
        title: "Rời trang khi chưa lưu?",
        description: `${dirtyCount} dòng cấu hình KPI đang có thay đổi chưa được lưu.`,
        confirmLabel: "Rời trang",
        destructive: true,
      }).then((accepted) => {
        if (accepted) router.push(nextPath);
      });
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleNavigationClick, true);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleNavigationClick, true);
    };
  }, [confirm, dirtyCount, isKpiConfigView, router]);

  const resetKpiChanges = () => {
    setKpiConfigs(savedKpiConfigs.map((row) => ({ ...row })));
    setRowSaveStates({});
  };

  const userStats = useMemo(() => {
    const managerCount = users.filter((user) => user.role === "MANAGER").length;
    const ctvCount = users.filter((user) => user.role === "CTV").length;
    const gpsEnabled = users.filter((user) => Boolean(user.canUseGps)).length;
    return { total: users.length, managerCount, ctvCount, gpsEnabled };
  }, [users]);

  const configEffectiveMap = useMemo(() => {
    const map = new Map<string, KpiEffectiveGroupInfo>();

    for (const row of kpiConfigs) {
      if (Number(row.isEnabled) !== 1) continue;
      const mergeGroup = String(row.mergeGroup || "").trim();
      const groupKey = mergeGroup || `single:${row.kpiCode}`;
      const current = map.get(groupKey) || {
        effectiveBaseScore: 0,
        effectiveMaxScore: 0,
        memberCount: 0,
      };
      const baseScore = toNumericValue(row.baseScore);
      const maxPercent = toNumericValue(row.maxPercent);

      current.effectiveBaseScore += baseScore;
      current.effectiveMaxScore += (baseScore * maxPercent) / 100;
      current.memberCount += 1;
      map.set(groupKey, current);
    }

    return map;
  }, [kpiConfigs]);

  const configStats = useMemo(() => {
    const total = kpiConfigs.length;
    const enabled = kpiConfigs.filter((row) => Number(row.isEnabled) === 1).length;
    let effectiveBaseTotal = 0;
    let effectiveMaxTotal = 0;

    for (const value of configEffectiveMap.values()) {
      effectiveBaseTotal += value.effectiveBaseScore;
      effectiveMaxTotal += value.effectiveMaxScore;
    }

    return { total, enabled, effectiveBaseTotal, effectiveMaxTotal };
  }, [configEffectiveMap, kpiConfigs]);

  const getEffectiveConfigInfo = (row: KpiConfigRow) => {
    const isVisible = Number(row.isEnabled) === 1;
    const mergeGroup = String(row.mergeGroup || "").trim();

    if (!isVisible) {
      return {
        isVisible,
        mergeGroup,
        memberCount: 0,
        effectiveBaseScore: 0,
        effectiveMaxScore: 0,
      };
    }

    const groupKey = mergeGroup || `single:${row.kpiCode}`;
    const groupedInfo = configEffectiveMap.get(groupKey);
    const baseScore = toNumericValue(row.baseScore);
    const maxScore = (baseScore * toNumericValue(row.maxPercent)) / 100;

    return {
      isVisible,
      mergeGroup,
      memberCount: groupedInfo?.memberCount || 1,
      effectiveBaseScore: groupedInfo?.effectiveBaseScore ?? baseScore,
      effectiveMaxScore: groupedInfo?.effectiveMaxScore ?? maxScore,
    };
  };

  if (isKpiConfigView) {
    return (
      <div className={ctvStyles.page}>
        <div className={ctvStyles.segmentedNav}>
          <Link href="/ctv" className={navClassName(false)}>
            Danh sách CTV
          </Link>
          <Link href="/ctv?view=kpi-config" className={navClassName(true)}>
            Cấu hình KPI
          </Link>
        </div>

        <section className={`glass-panel ${ctvStyles.hero}`}>
          <div className={ctvStyles.heroCopy}>
            <span className={ctvStyles.eyebrow}>Thiết lập KPI</span>
            <h1 className={ctvStyles.heroTitle}>Cấu hình KPI</h1>
            <p className={ctvStyles.heroSubtitle}>
              Quản lý tên hiển thị, nhóm gộp, điểm chuẩn, phần trăm tối đa và trạng thái hiển thị của từng mã chỉ tiêu.
            </p>
          </div>
          <div className={ctvStyles.heroActions}>
            <div className={ctvStyles.heroStatusStack}>
              <div className={ctvStyles.heroHint}>
                Điểm hiệu lực bên dưới là đúng con số đang xuất hiện trên KPI và Tính KPI sau khi gộp nhóm.
              </div>
              <div
                className={`${ctvStyles.dirtySummary} ${dirtyCount > 0 ? ctvStyles.dirtySummaryActive : ""}`}
                role="status"
              >
                {dirtyCount > 0 ? `${dirtyCount} dòng chưa lưu` : "Cấu hình đã đồng bộ"}
                {invalidDirtyCount > 0 ? ` · ${invalidDirtyCount} dòng cần kiểm tra` : ""}
              </div>
            </div>
            {dirtyCount > 0 && (
              <button className="btn btn-secondary" onClick={resetKpiChanges} disabled={savingAll} type="button">
                <RotateCcw size={16} /> Hoàn tác
              </button>
            )}
            <button
              className="btn btn-primary"
              onClick={saveAllKpiConfigs}
              disabled={savingAll || kpiLoading || dirtyCount === 0 || invalidDirtyCount > 0}
              type="button"
            >
              {savingAll ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {savingAll ? "Đang lưu" : `Lưu tất cả${dirtyCount > 0 ? ` (${dirtyCount})` : ""}`}
            </button>
          </div>
        </section>

        <section className={ctvStyles.statsGrid}>
          <article className={ctvStyles.statCard}>
            <span className={ctvStyles.statLabel}>Tổng chỉ tiêu</span>
            <strong className={ctvStyles.statValue}>{configStats.total}</strong>
            <span className={ctvStyles.statHint}>Số mã KPI đang có trong cấu hình</span>
          </article>
          <article className={`${ctvStyles.statCard} ${ctvStyles.statCardAccent}`}>
            <span className={ctvStyles.statLabel}>Đang hiển thị</span>
            <strong className={ctvStyles.statValue}>{configStats.enabled}</strong>
            <span className={ctvStyles.statHint}>Các KPI đang bật cho báo cáo</span>
          </article>
          <article className={ctvStyles.statCard}>
            <span className={ctvStyles.statLabel}>Điểm chuẩn hiển thị</span>
            <strong className={ctvStyles.statValue}>{pointFormatter.format(configStats.effectiveBaseTotal)}</strong>
            <span className={ctvStyles.statHint}>Tổng điểm chuẩn thực tế đang chạy sau khi gộp nhóm</span>
          </article>
          <article className={`${ctvStyles.statCard} ${ctvStyles.statCardMuted}`}>
            <span className={ctvStyles.statLabel}>Điểm tối đa hiển thị</span>
            <strong className={ctvStyles.statValue}>{pointFormatter.format(configStats.effectiveMaxTotal)}</strong>
            <span className={ctvStyles.statHint}>Tổng điểm tối đa thực tế đang chạy sau khi gộp nhóm</span>
          </article>
        </section>

        <section className={`glass-panel ${ctvStyles.sectionShell}`}>
          <div className={ctvStyles.sectionHeader}>
            <div>
              <h2 className={ctvStyles.sectionTitle}>Danh sách cấu hình</h2>
              <p className={ctvStyles.sectionSubtitle}>
                Điểm cấu hình là điểm từng dòng. Điểm hiệu lực là điểm thực tế xuất hiện trên KPI sau khi áp dụng nhóm gộp và chỉ tiêu đang bật.
              </p>
            </div>
          </div>

          {kpiLoading ? (
            <AsyncState compact status="loading" title="Đang tải cấu hình KPI" />
          ) : kpiLoadError ? (
            <AsyncState
              compact
              status="error"
              title="Không thể tải cấu hình KPI"
              description={kpiLoadError}
              actionLabel="Thử lại"
              onAction={() => void fetchKpiConfig()}
            />
          ) : kpiConfigs.length === 0 ? (
            <AsyncState compact status="empty" title="Chưa có cấu hình KPI" />
          ) : (
            <>
              <div className={ctvStyles.configTable}>
                <div className={ctvStyles.configTableHead}>
                  <span>Mã chỉ tiêu</span>
                  <span>Tên hiển thị</span>
                  <span>Nhóm gộp</span>
                  <span>Điểm cấu hình / hiệu lực</span>
                  <span>Hiển thị</span>
                </div>
                <div className={ctvStyles.configTableBody}>
                  {kpiConfigs.map((row) => {
                    const effectiveInfo = getEffectiveConfigInfo(row);
                    const rowErrors = validationByCode.get(row.kpiCode) || {};
                    const rowErrorMessages = Object.values(rowErrors);
                    const rowSaveState = rowSaveStates[row.kpiCode];
                    const isDirty = dirtyKpiCodes.has(row.kpiCode);
                    const safeCode = row.kpiCode.replace(/[^a-zA-Z0-9_-]/g, "-");
                    const codeLabelId = `kpi-code-${safeCode}`;
                    const displayNameId = `kpi-display-name-${safeCode}`;
                    const mergeGroupId = `kpi-merge-group-${safeCode}`;
                    const baseScoreId = `kpi-base-score-${safeCode}`;
                    const maxPercentId = `kpi-max-percent-${safeCode}`;
                    const validationId = `kpi-validation-${safeCode}`;

                    return (
                      <div
                        key={row.kpiCode}
                        className={`${ctvStyles.configRow} ${isDirty ? ctvStyles.configRowDirty : ""} ${rowErrorMessages.length > 0 ? ctvStyles.configRowInvalid : ""}`}
                        role="group"
                        aria-labelledby={codeLabelId}
                      >
                        <div className={ctvStyles.configCodeBlock}>
                          <span className={ctvStyles.mobileFieldLabel}>Mã chỉ tiêu</span>
                          <strong id={codeLabelId}>{row.kpiCode}</strong>
                          <div className={ctvStyles.rowStateStack}>
                            {isDirty && <span className={ctvStyles.rowDirtyBadge}>Chưa lưu</span>}
                            {rowSaveState?.status === "saving" && (
                              <span className={ctvStyles.rowSavingStatus}><Loader2 size={13} className="animate-spin" /> Đang lưu</span>
                            )}
                            {rowSaveState?.status === "success" && (
                              <span className={ctvStyles.rowSuccessStatus}><CheckCircle2 size={13} /> Đã lưu</span>
                            )}
                          </div>
                        </div>
                        <div className={ctvStyles.configField}>
                          <label className={ctvStyles.mobileFieldLabel} htmlFor={displayNameId}>Tên hiển thị</label>
                          <input
                            id={displayNameId}
                            className="input-base"
                            value={row.displayName || ""}
                            onChange={(event) => updateKpiRow(row.kpiCode, { displayName: event.target.value })}
                            placeholder="Tên hiển thị"
                          />
                        </div>
                        <div className={ctvStyles.configField}>
                          <label className={ctvStyles.mobileFieldLabel} htmlFor={mergeGroupId}>Nhóm gộp</label>
                          <input
                            id={mergeGroupId}
                            className="input-base"
                            value={row.mergeGroup || ""}
                            onChange={(event) => updateKpiRow(row.kpiCode, { mergeGroup: event.target.value })}
                            placeholder="Ví dụ: Chỉ tiêu IOT"
                          />
                        </div>
                        <div className={ctvStyles.configMetricStack}>
                          <div className={ctvStyles.configMetricGroup}>
                            <div className={ctvStyles.configField}>
                              <label className={ctvStyles.mobileFieldLabel} htmlFor={baseScoreId}>Điểm chuẩn</label>
                              <input
                                id={baseScoreId}
                                className="input-base"
                                type="number"
                                value={row.baseScore}
                                aria-invalid={Boolean(rowErrors.baseScore)}
                                aria-describedby={rowErrors.baseScore ? validationId : undefined}
                                onChange={(event) =>
                                  updateKpiRow(row.kpiCode, { baseScore: event.target.value })
                                }
                              />
                            </div>
                            <div className={ctvStyles.configField}>
                              <label className={ctvStyles.mobileFieldLabel} htmlFor={maxPercentId}>% tối đa</label>
                              <input
                                id={maxPercentId}
                                className="input-base"
                                type="number"
                                value={row.maxPercent}
                                aria-invalid={Boolean(rowErrors.maxPercent)}
                                aria-describedby={rowErrors.maxPercent ? validationId : undefined}
                                onChange={(event) =>
                                  updateKpiRow(row.kpiCode, { maxPercent: event.target.value })
                                }
                              />
                            </div>
                          </div>
                          <div className={ctvStyles.configEffectiveCard}>
                            <div className={ctvStyles.configEffectiveHead}>
                              <span className={ctvStyles.configEffectiveLabel}>Hiển thị trên KPI</span>
                              {effectiveInfo.isVisible && effectiveInfo.memberCount > 1 ? (
                                <span className={ctvStyles.configEffectiveBadge}>Nhóm {effectiveInfo.memberCount}</span>
                              ) : null}
                            </div>
                            {effectiveInfo.isVisible ? (
                              <>
                                <strong className={ctvStyles.configEffectiveValue}>
                                  {pointFormatter.format(effectiveInfo.effectiveBaseScore)} / {" "}
                                  {pointFormatter.format(effectiveInfo.effectiveMaxScore)} điểm
                                </strong>
                                <span className={ctvStyles.configEffectiveHint}>
                                  {effectiveInfo.mergeGroup
                                    ? `Gộp theo nhóm "${effectiveInfo.mergeGroup}".`
                                    : "Chỉ tiêu riêng, không gộp nhóm."}
                                </span>
                              </>
                            ) : (
                              <span className={ctvStyles.configEffectiveHidden}>
                                Đang ẩn trên KPI, không tính vào điểm hiển thị.
                              </span>
                            )}
                          </div>
                        </div>
                        <label className={ctvStyles.toggleCard}>
                          <span className={ctvStyles.mobileFieldLabel}>Hiển thị</span>
                          <span className={ctvStyles.toggleCardControl}>
                            <input
                              type="checkbox"
                              aria-label={`Hiển thị ${row.kpiCode}`}
                              checked={Number(row.isEnabled) === 1}
                              onChange={(event) =>
                                updateKpiRow(row.kpiCode, { isEnabled: event.target.checked ? 1 : 0 })
                              }
                            />
                            <span>{Number(row.isEnabled) === 1 ? "Đang hiển thị" : "Đang ẩn"}</span>
                          </span>
                        </label>
                        {rowErrorMessages.length > 0 && (
                          <div id={validationId} className={ctvStyles.rowErrorMessage} role="alert">
                            {rowErrorMessages.join(". ")}
                          </div>
                        )}
                        {rowSaveState?.status === "error" && (
                          <div className={ctvStyles.rowErrorMessage} role="alert">
                            {rowSaveState.message || `Không thể lưu ${row.kpiCode}`}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className={ctvStyles.mobileStickySave}>
                <div className={ctvStyles.mobileSaveSummary} role="status">
                  {dirtyCount > 0 ? `Chưa lưu: ${dirtyCount} dòng` : "Đã đồng bộ"}
                </div>
                <button
                  className="btn btn-primary"
                  onClick={saveAllKpiConfigs}
                  disabled={savingAll || kpiLoading || dirtyCount === 0 || invalidDirtyCount > 0}
                  type="button"
                >
                  {savingAll ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  {savingAll ? "Đang lưu" : "Lưu toàn bộ thay đổi"}
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className={ctvStyles.page}>
      <div className={ctvStyles.segmentedNav}>
        <Link href="/ctv" className={navClassName(true)}>
          Danh sách CTV
        </Link>
        <Link href="/ctv?view=kpi-config" className={navClassName(false)}>
          Cấu hình KPI
        </Link>
      </div>

      <section className={`glass-panel ${ctvStyles.hero}`}>
        <div className={ctvStyles.heroCopy}>
          <span className={ctvStyles.eyebrow}>Quản trị cộng tác viên</span>
          <h1 className={ctvStyles.heroTitle}>Danh sách CTV</h1>
          <p className={ctvStyles.heroSubtitle}>
            Quản lý tài khoản CTV và quản lý: phân quyền, mã phụ dùng cho KPI, quản lý trực thuộc và quyền dùng GPS.
          </p>
        </div>
        <div className={ctvStyles.heroActions}>
          <div className={ctvStyles.heroHint}>Danh sách được lọc theo tên đăng nhập để tìm nhanh và chỉnh sửa trực tiếp.</div>
          <button
            onClick={() => {
              setEditingUser(null);
              setIsModalOpen(true);
            }}
            className="btn btn-primary"
          >
            <Plus size={18} />
            Thêm CTV mới
          </button>
        </div>
      </section>

      <section className={`${ctvStyles.statsGrid} ${ctvStyles.userStatsCompact}`} aria-label="Thống kê tài khoản CTV">
        <article className={ctvStyles.statCard}>
          <span className={ctvStyles.statLabel}>Tổng tài khoản</span>
          <strong className={ctvStyles.statValue}>{userStats.total}</strong>
          <span className={ctvStyles.statHint}>Toàn bộ tài khoản CTV và quản lý trong hệ thống</span>
        </article>
        <article className={`${ctvStyles.statCard} ${ctvStyles.statCardAccent}`}>
          <span className={ctvStyles.statLabel}>CTV</span>
          <strong className={ctvStyles.statValue}>{userStats.ctvCount}</strong>
          <span className={ctvStyles.statHint}>Tài khoản cộng tác viên đang hoạt động</span>
        </article>
        <article className={ctvStyles.statCard}>
          <span className={ctvStyles.statLabel}>Quản lý</span>
          <strong className={ctvStyles.statValue}>{userStats.managerCount}</strong>
          <span className={ctvStyles.statHint}>Tài khoản quản lý đang theo dõi CTV</span>
        </article>
        <article className={`${ctvStyles.statCard} ${ctvStyles.statCardMuted}`}>
          <span className={ctvStyles.statLabel}>GPS bật</span>
          <strong className={ctvStyles.statValue}>{userStats.gpsEnabled}</strong>
          <span className={ctvStyles.statHint}>Số tài khoản được phép lấy vị trí hiện tại</span>
        </article>
      </section>

      <section className={`glass-panel ${ctvStyles.sectionShell}`}>
        <div className={ctvStyles.sectionHeader}>
          <div>
            <h2 className={ctvStyles.sectionTitle}>Danh sách tài khoản</h2>
            <p className={ctvStyles.sectionSubtitle}>Desktop dùng bảng gọn để rà nhanh, mobile chuyển sang card nhẹ hơn.</p>
          </div>
          <div className={ctvStyles.toolbarMeta}>
            <span className={ctvStyles.metaChip}>
              <Users size={14} />
              {filteredUsers.length} kết quả
            </span>
            <span className={ctvStyles.metaChip}>
              <ShieldCheck size={14} />
              Admin quản trị
            </span>
          </div>
        </div>

        <div className={ctvStyles.listToolbar}>
          <div className={ctvStyles.searchField}>
            <Search size={17} className={ctvStyles.searchIcon} />
            <input
              type="text"
              placeholder="Tìm theo tên đăng nhập..."
              aria-label="Tìm tài khoản CTV"
              className={`input-base ${ctvStyles.searchInput}`}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <AsyncState compact status="loading" title="Đang tải danh sách CTV" />
        ) : loadError ? (
          <AsyncState
            compact
            status="error"
            title="Không thể tải danh sách CTV"
            description={loadError}
            actionLabel="Thử lại"
            onAction={() => void fetchUsers()}
          />
        ) : filteredUsers.length > 0 ? (
          <>
            <div className={ctvStyles.tableWrap}>
              <table className={ctvStyles.userTable}>
                <thead>
                  <tr>
                    <th>Tài khoản</th>
                    <th>Vai trò</th>
                    <th>Mã phụ</th>
                    <th>Quản lý</th>
                    <th>GPS</th>
                    <th>Ngày tạo</th>
                    <th className={ctvStyles.actionsCol}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <div className={ctvStyles.userCellMain}>
                          <strong>{user.username}</strong>
                          <span>ID #{user.id}</span>
                        </div>
                      </td>
                      <td>
                        <span
                          className={`${ctvStyles.roleBadge} ${
                            user.role === "MANAGER" ? ctvStyles.roleManager : ctvStyles.roleCtv
                          }`}
                        >
                          {user.role === "MANAGER" ? "Quản lý" : "CTV"}
                        </span>
                      </td>
                      <td className={ctvStyles.monoCell}>{user.secondaryCode || "---"}</td>
                      <td className={ctvStyles.monoCell}>{user.managerCode || "---"}</td>
                      <td>
                        <span
                          className={`${ctvStyles.gpsBadge} ${user.canUseGps ? ctvStyles.gpsOn : ctvStyles.gpsOff}`}
                        >
                          <MapPin size={12} />
                          {user.canUseGps ? "Bật" : "Tắt"}
                        </span>
                      </td>
                      <td>{new Date(user.createdAt).toLocaleDateString("vi-VN")}</td>
                      <td className={ctvStyles.actionsCol}>
                        <div className={ctvStyles.actionsRow}>
                          <button
                            onClick={() => {
                              setEditingUser(user);
                              setIsModalOpen(true);
                            }}
                            className={compactActionBtn}
                          >
                            <Edit size={15} />
                            Sửa
                          </button>
                          <button onClick={() => handleDelete(user)} className={compactDangerBtn}>
                            <Trash2 size={15} />
                            Xóa
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className={ctvStyles.mobileCardList}>
              {filteredUsers.map((user) => (
                <article key={`mobile-${user.id}`} className={ctvStyles.mobileUserCard}>
                  <div className={ctvStyles.mobileUserHead}>
                    <div>
                      <strong className={ctvStyles.mobileUserName}>{user.username}</strong>
                      <span className={ctvStyles.mobileUserSub}>ID #{user.id}</span>
                    </div>
                    <span
                      className={`${ctvStyles.roleBadge} ${
                        user.role === "MANAGER" ? ctvStyles.roleManager : ctvStyles.roleCtv
                      }`}
                    >
                      {user.role === "MANAGER" ? "Quản lý" : "CTV"}
                    </span>
                  </div>
                  <div className={ctvStyles.mobileInfoGrid}>
                    <div className={ctvStyles.mobileInfoItem}>
                      <span>Mã phụ</span>
                      <strong>{user.secondaryCode || "---"}</strong>
                    </div>
                    <div className={ctvStyles.mobileInfoItem}>
                      <span>Quản lý</span>
                      <strong>{user.managerCode || "---"}</strong>
                    </div>
                    <div className={ctvStyles.mobileInfoItem}>
                      <span>Ngày tạo</span>
                      <strong>{new Date(user.createdAt).toLocaleDateString("vi-VN")}</strong>
                    </div>
                    <div className={ctvStyles.mobileInfoItem}>
                      <span>GPS</span>
                      <strong className={user.canUseGps ? ctvStyles.textSuccess : ctvStyles.textMuted}>
                        {user.canUseGps ? "Đang bật" : "Đang tắt"}
                      </strong>
                    </div>
                  </div>
                  <div className={ctvStyles.mobileCardFooter}>
                    <span className={`${ctvStyles.gpsBadge} ${user.canUseGps ? ctvStyles.gpsOn : ctvStyles.gpsOff}`}>
                      <MapPin size={12} />
                      {user.canUseGps ? "Cho phép GPS" : "Không dùng GPS"}
                    </span>
                    <div className={ctvStyles.actionsRow}>
                      <button
                        onClick={() => {
                          setEditingUser(user);
                          setIsModalOpen(true);
                        }}
                        className={compactActionBtn}
                      >
                        <Edit size={15} />
                        Sửa
                      </button>
                      <button onClick={() => handleDelete(user)} className={compactDangerBtn}>
                        <Trash2 size={15} />
                        Xóa
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </>
        ) : (
          <AsyncState
            compact
            status="empty"
            title={searchQuery ? "Không có CTV phù hợp" : "Chưa có tài khoản CTV"}
            description={searchQuery ? "Hãy thử từ khóa khác." : "Tạo tài khoản đầu tiên để bắt đầu phân công khách hàng."}
          />
        )}
      </section>

      {isModalOpen ? (
        <CtvModal user={editingUser} onClose={() => setIsModalOpen(false)} onRefresh={fetchUsers} />
      ) : null}
    </div>
  );
}
