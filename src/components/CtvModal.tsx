"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, Loader2, RefreshCcw, ShieldCheck, X } from "lucide-react";
import styles from "./CtvModal.module.css";
import { useConfirmDialog } from "@/components/ui/ConfirmDialogProvider";
import { useDialogAccessibility } from "@/hooks/useDialogAccessibility";

type ModalUser = {
  id: string | number;
  username: string;
  role: string;
  secondaryCode?: string | null;
  managerCode?: string | null;
  canUseGps?: boolean;
};

type ManagerOption = {
  id: string | number;
  username: string;
};

type FormState = {
  username: string;
  password: string;
  role: string;
  managerCode: string;
  secondaryCode: string;
  canUseGps: boolean;
};

type FieldErrors = Partial<Record<"username" | "password", string>>;

const INITIAL_FORM: FormState = {
  username: "",
  password: "",
  role: "CTV",
  managerCode: "",
  secondaryCode: "",
  canUseGps: true,
};

function suggestSecondaryCode(username: string) {
  return username
    .trim()
    .split("_")
    .filter(Boolean)
    .reverse()
    .join("_");
}

export default function CtvModal({
  user,
  onClose,
  onRefresh,
}: {
  user: ModalUser | null;
  onClose: () => void;
  onRefresh: () => void | Promise<void>;
}) {
  const isEditing = Boolean(user);
  const [formData, setFormData] = useState<FormState>(INITIAL_FORM);
  const [managers, setManagers] = useState<ManagerOption[]>([]);
  const [loadingManagers, setLoadingManagers] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const confirm = useConfirmDialog();

  useEffect(() => {
    setFormData({
      username: user?.username || "",
      password: "",
      role: user?.role || "CTV",
      managerCode: user?.managerCode || "",
      secondaryCode: user?.secondaryCode || "",
      canUseGps: Boolean(user?.canUseGps ?? true),
    });
    setFieldErrors({});
    setShowPassword(false);
  }, [user]);

  useEffect(() => {
    let active = true;

    const loadManagers = async () => {
      setLoadingManagers(true);
      try {
        const res = await fetch("/api/users?role=MANAGER");
        const data = await res.json().catch(() => []);
        if (!active) return;

        if (res.ok) {
          const nextManagers = Array.isArray(data) ? data : [];
          setManagers(
            nextManagers
              .filter((manager) => String(manager.id) !== String(user?.id || ""))
              .map((manager) => ({
                id: manager.id,
                username: manager.username,
              })),
          );
        } else {
          setManagers([]);
        }
      } catch {
        if (active) setManagers([]);
      } finally {
        if (active) setLoadingManagers(false);
      }
    };

    void loadManagers();

    return () => {
      active = false;
    };
  }, [user?.id]);

  const dirty = useMemo(() => {
    if (!isEditing) {
      return (
        formData.username !== INITIAL_FORM.username ||
        formData.password !== INITIAL_FORM.password ||
        formData.role !== INITIAL_FORM.role ||
        formData.managerCode !== INITIAL_FORM.managerCode ||
        formData.secondaryCode !== INITIAL_FORM.secondaryCode ||
        formData.canUseGps !== INITIAL_FORM.canUseGps
      );
    }

    return (
      formData.username !== (user?.username || "") ||
      formData.password !== "" ||
      formData.role !== (user?.role || "CTV") ||
      formData.managerCode !== (user?.managerCode || "") ||
      formData.secondaryCode !== (user?.secondaryCode || "") ||
      formData.canUseGps !== Boolean(user?.canUseGps ?? true)
    );
  }, [formData, isEditing, user]);

  const isManagerRole = formData.role === "MANAGER";

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    if (key === "username" || key === "password") {
      const fieldKey: keyof FieldErrors = key;
      setFieldErrors((prev) => {
        if (!prev[fieldKey]) return prev;
        const next = { ...prev };
        delete next[fieldKey];
        return next;
      });
    }
  };

  const applySuggestedSecondaryCode = () => {
    updateField("secondaryCode", suggestSecondaryCode(formData.username));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    const payload = {
      username: formData.username.trim(),
      password: formData.password ? formData.password : undefined,
      role: formData.role,
      managerCode: isManagerRole ? null : formData.managerCode.trim() || null,
      secondaryCode: formData.secondaryCode.trim() || null,
      canUseGps: formData.canUseGps,
    };

    const nextFieldErrors: FieldErrors = {};
    if (!payload.username) nextFieldErrors.username = "Vui lòng nhập tài khoản.";
    if (!isEditing && !payload.password) nextFieldErrors.password = "Vui lòng nhập mật khẩu cho tài khoản mới.";
    setFieldErrors(nextFieldErrors);
    if (Object.keys(nextFieldErrors).length > 0) {
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(isEditing ? `/api/users/${user?.id}` : "/api/users", {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Không thể lưu tài khoản.");
      }

      await onRefresh();
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Không thể lưu tài khoản.");
    } finally {
      setSaving(false);
    }
  };

  const handleRequestClose = async () => {
    if (saving) return;
    if (dirty) {
      const accepted = await confirm({
        title: "Bỏ thay đổi tài khoản?",
        description: "Thông tin CTV vừa chỉnh sửa sẽ không được lưu.",
        confirmLabel: "Bỏ thay đổi",
        destructive: true,
      });
      if (!accepted) return;
    }
    onClose();
  };

  const dialogRef = useDialogAccessibility<HTMLDivElement>({
    onClose: () => void handleRequestClose(),
    closeOnEscape: !saving,
  });

  return (
    <div
      className={styles.overlay}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) void handleRequestClose();
      }}
    >
      <div
        ref={dialogRef}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ctv-modal-title"
        tabIndex={-1}
      >
        <div className={styles.header}>
          <div className={styles.headerCopy}>
            <span className={styles.eyebrow}>Quản lý tài khoản CTV</span>
            <div className={styles.titleRow}>
              <h2 id="ctv-modal-title" className={styles.title}>{isEditing ? "Chỉnh sửa tài khoản" : "Thêm tài khoản mới"}</h2>
              <div className={styles.badges}>
                <span className={styles.modeBadge}>{isManagerRole ? "Quản lý" : "CTV"}</span>
                {dirty ? <span className={styles.dirtyBadge}>Chưa lưu</span> : null}
              </div>
            </div>
            <p className={styles.subtitle}>
              Đồng bộ vai trò, mã phụ KPI, quản lý trực tiếp và quyền GPS trong cùng một màn hình.
            </p>
          </div>
          <button
            type="button"
            className={`ui-action-btn ui-action-btn--icon ui-action-btn--pill ${styles.closeBtn}`}
            onClick={() => void handleRequestClose()}
            aria-label="Đóng"
          >
            <X size={18} />
          </button>
        </div>

        {error ? <div className={styles.errorBanner} role="alert">{error}</div> : null}

        <form className={styles.body} onSubmit={handleSubmit}>
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <div>
                <h3 className={styles.sectionTitle}>Đăng nhập và phân quyền</h3>
                <p className={styles.sectionSubtitle}>Những trường này quyết định cách tài khoản xuất hiện trong hệ thống.</p>
              </div>
              <span className={styles.sectionMeta}>{isEditing ? `ID #${user?.id}` : "Tài khoản mới"}</span>
            </div>

            <div className={styles.grid}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="ctv-username">Tài khoản</label>
                <input
                  id="ctv-username"
                  className="input-base"
                  value={formData.username}
                  onChange={(event) => updateField("username", event.target.value)}
                  placeholder="Ví dụ: anlt_ldg_cnkd"
                  autoFocus
                  autoComplete="username"
                  aria-invalid={Boolean(fieldErrors.username)}
                  aria-describedby={fieldErrors.username ? "ctv-username-error" : "ctv-username-help"}
                />
                {fieldErrors.username ? (
                  <span id="ctv-username-error" className={styles.fieldError} role="alert">{fieldErrors.username}</span>
                ) : (
                  <span id="ctv-username-help" className={styles.helper}>Tên đăng nhập duy nhất, dùng để đăng nhập và nhận diện trên báo cáo.</span>
                )}
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="ctv-password">{isEditing ? "Mật khẩu mới" : "Mật khẩu"}</label>
                <div className={styles.passwordControl}>
                  <input
                    id="ctv-password"
                    className="input-base"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(event) => updateField("password", event.target.value)}
                    placeholder={isEditing ? "Để trống nếu không đổi" : "Nhập mật khẩu"}
                    autoComplete="new-password"
                    aria-invalid={Boolean(fieldErrors.password)}
                    aria-describedby={fieldErrors.password ? "ctv-password-error" : "ctv-password-help"}
                  />
                  <button
                    type="button"
                    className={styles.passwordToggle}
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
                {fieldErrors.password ? (
                  <span id="ctv-password-error" className={styles.fieldError} role="alert">{fieldErrors.password}</span>
                ) : (
                  <span id="ctv-password-help" className={styles.helper}>
                    {isEditing ? "Chỉ nhập nếu cần đổi mật khẩu hiện tại." : "Mật khẩu sẽ được băm trước khi lưu."}
                  </span>
                )}
              </div>

              <label className={styles.field}>
                <span className={styles.label}>Vai trò</span>
                <select
                  className="input-base"
                  value={formData.role}
                  onChange={(event) => updateField("role", event.target.value)}
                >
                  <option value="CTV">CTV</option>
                  <option value="MANAGER">Quản lý</option>
                </select>
              </label>

              <label className={styles.field}>
                <span className={styles.label}>Quản lý trực tiếp</span>
                <select
                  className="input-base"
                  value={isManagerRole ? "" : formData.managerCode}
                  onChange={(event) => updateField("managerCode", event.target.value)}
                  disabled={isManagerRole || loadingManagers}
                >
                  <option value="">{loadingManagers ? "Đang tải danh sách..." : "Không gán quản lý"}</option>
                  {managers.map((manager) => (
                    <option key={manager.id} value={manager.username}>
                      {manager.username}
                    </option>
                  ))}
                </select>
                <span className={styles.helper}>
                  {isManagerRole
                    ? "Tài khoản quản lý không cần gán quản lý trực tiếp."
                    : "CTV có thể gắn với một quản lý để phục vụ phân quyền và báo cáo."}
                </span>
              </label>
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <div>
                <h3 className={styles.sectionTitle}>Mã phụ và GPS</h3>
                <p className={styles.sectionSubtitle}>Các trường này phục vụ KPI, CDT và tác vụ hiện trường.</p>
              </div>
              <button
                type="button"
                className="ui-action-btn ui-action-btn--compact ui-action-btn--pill"
                onClick={applySuggestedSecondaryCode}
                disabled={!formData.username.trim()}
              >
                <RefreshCcw size={15} />
                Gợi ý mã phụ
              </button>
            </div>

            <div className={styles.grid}>
              <label className={styles.field}>
                <span className={styles.label}>Mã phụ KPI</span>
                <input
                  className="input-base"
                  value={formData.secondaryCode}
                  onChange={(event) => updateField("secondaryCode", event.target.value)}
                  placeholder="Ví dụ: ANLT_LDG_CNKD"
                />
                <span className={styles.helper}>Dùng để map dữ liệu KPI, CDT và các báo cáo tổng hợp.</span>
              </label>

              <div className={`${styles.field} ${styles.checkboxField}`}>
                <span className={styles.label}>Quyền vị trí</span>
                <label className={styles.checkboxCard}>
                  <span className={styles.checkboxCopy}>
                    <strong>Cho phép dùng GPS</strong>
                    <span>Tài khoản có thể lấy vị trí hiện tại trên app hiện trường.</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={formData.canUseGps}
                    onChange={(event) => updateField("canUseGps", event.target.checked)}
                  />
                </label>
                <span className={styles.helper}>
                  Nếu không cần định vị, nên tắt để tránh phát sinh quyền trên thiết bị.
                </span>
              </div>
            </div>

            <div className={styles.noteStrip}>
              <ShieldCheck size={16} />
              <span>
                Dữ liệu trong form này được dùng chung cho module CTV, KPI, CDT và các bộ lọc quản lý.
              </span>
            </div>
          </section>

          <div className={styles.footer}>
            <span className={styles.footerHint}>
              {isEditing ? "Đổi mật khẩu là thao tác không thể hoàn tác." : "Tài khoản sẽ hoạt động ngay sau khi tạo."}
            </span>
            <div className={styles.footerActions}>
              <button type="button" className="btn btn-secondary" onClick={() => void handleRequestClose()} disabled={saving}>
                Hủy
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                {isEditing ? "Lưu thay đổi" : "Tạo tài khoản"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
