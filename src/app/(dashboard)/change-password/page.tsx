"use client";

import { useRef, useState } from "react";
import { KeyRound, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import PasswordInput from "@/components/PasswordInput";
import styles from "../customers/customers.module.css";

const PASSWORD_CHANGE_UNCERTAIN = "Không thể xác nhận kết quả đổi mật khẩu. Hãy kiểm tra kết nối và thử đăng nhập lại trước khi gửi lại.";
const MASKED_PASSWORD_FIELDS = { currentPassword: false, newPassword: false, confirmPassword: false };

export default function ChangePasswordPage() {
    const submittingRef = useRef(false);
    const [formData, setFormData] = useState({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
    });
    const [loading, setLoading] = useState(false);
    const [visibleFields, setVisibleFields] = useState(MASKED_PASSWORD_FIELDS);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const togglePasswordVisibility = (field: keyof typeof MASKED_PASSWORD_FIELDS) => {
        if (submittingRef.current) return;
        setVisibleFields((current) => ({ ...current, [field]: !current[field] }));
    };

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (submittingRef.current) return;
        const { name, value } = event.target;
        setFormData((current) => ({ ...current, [name]: value }));
        setMessage(null);
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (submittingRef.current) return;
        setVisibleFields(MASKED_PASSWORD_FIELDS);
        setMessage(null);

        // Client-side validation
        if (formData.newPassword.length < 6) {
            setMessage({ type: "error", text: "Mật khẩu mới phải có ít nhất 6 ký tự" });
            return;
        }

        if (formData.newPassword !== formData.confirmPassword) {
            setMessage({ type: "error", text: "Xác nhận mật khẩu không khớp" });
            return;
        }

        submittingRef.current = true;
        setLoading(true);
        try {
            const res = await fetch("/api/change-password", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    currentPassword: formData.currentPassword,
                    newPassword: formData.newPassword,
                }),
            });

            const data: unknown = await res.json();
            const payload = typeof data === "object" && data !== null && !Array.isArray(data) ? data : null;

            if (!res.ok) {
                const apiError = payload && "error" in payload && typeof payload.error === "string" ? payload.error : "";
                setMessage({ type: "error", text: res.status >= 400 && res.status < 500 && apiError.trim() ? apiError : PASSWORD_CHANGE_UNCERTAIN });
                return;
            }
            if (res.status !== 200 || !payload || "error" in payload || !("message" in payload) || typeof payload.message !== "string" || !payload.message.trim()) {
                setMessage({ type: "error", text: PASSWORD_CHANGE_UNCERTAIN });
                return;
            }

            setMessage({ type: "success", text: "Đổi mật khẩu thành công!" });
            setFormData({ currentPassword: "", newPassword: "", confirmPassword: "" });
        } catch {
            setMessage({ type: "error", text: PASSWORD_CHANGE_UNCERTAIN });
        } finally {
            submittingRef.current = false;
            setLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>Đổi Mật Khẩu</h1>
                    <p className={styles.subtitle}>Thay đổi mật khẩu tài khoản của bạn</p>
                </div>
            </div>

            <div className={`glass-panel ${styles.content}`}>
                <form method="post" onSubmit={handleSubmit} style={{ maxWidth: "450px" }} aria-busy={loading} aria-describedby={message ? "change-password-message" : undefined}>
                    {message && (
                        <div
                            id="change-password-message"
                            role={message.type === "success" ? "status" : "alert"}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "0.5rem",
                                padding: "0.75rem 1rem",
                                borderRadius: "var(--radius)",
                                marginBottom: "1rem",
                                fontSize: "0.85rem",
                                fontWeight: 500,
                                background: message.type === "success"
                                    ? "rgba(34, 197, 94, 0.1)"
                                    : "rgba(239, 68, 68, 0.1)",
                                color: message.type === "success"
                                    ? "#22c55e"
                                    : "#ef4444",
                                border: `1px solid ${message.type === "success" ? "rgba(34, 197, 94, 0.25)" : "rgba(239, 68, 68, 0.25)"}`,
                            }}
                        >
                            {message.type === "success"
                                ? <CheckCircle size={16} />
                                : <AlertCircle size={16} />}
                            {message.text}
                        </div>
                    )}

                    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                        <div>
                            <label className="label-base" htmlFor="current-password">Mật khẩu hiện tại *</label>
                            <PasswordInput
                                id="current-password"
                                name="currentPassword"
                                visible={visibleFields.currentPassword}
                                visibilityLabel="mật khẩu hiện tại"
                                onToggle={() => togglePasswordVisibility("currentPassword")}
                                autoComplete="current-password"
                                disabled={loading}
                                required
                                className="input-base"
                                value={formData.currentPassword}
                                onChange={handleChange}
                                placeholder="Nhập mật khẩu hiện tại"
                            />
                        </div>

                        <div>
                            <label className="label-base" htmlFor="new-password">Mật khẩu mới *</label>
                            <PasswordInput
                                id="new-password"
                                name="newPassword"
                                visible={visibleFields.newPassword}
                                visibilityLabel="mật khẩu mới"
                                onToggle={() => togglePasswordVisibility("newPassword")}
                                autoComplete="new-password"
                                disabled={loading}
                                required
                                minLength={6}
                                className="input-base"
                                value={formData.newPassword}
                                onChange={handleChange}
                                placeholder="Tối thiểu 6 ký tự"
                            />
                        </div>

                        <div>
                            <label className="label-base" htmlFor="confirm-password">Xác nhận mật khẩu mới *</label>
                            <PasswordInput
                                id="confirm-password"
                                name="confirmPassword"
                                visible={visibleFields.confirmPassword}
                                visibilityLabel="xác nhận mật khẩu mới"
                                onToggle={() => togglePasswordVisibility("confirmPassword")}
                                autoComplete="new-password"
                                disabled={loading}
                                required
                                minLength={6}
                                className="input-base"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                placeholder="Nhập lại mật khẩu mới"
                            />
                        </div>

                        <div style={{ paddingTop: "0.5rem" }}>
                            <button
                                type="submit"
                                aria-label={loading ? "Đang đổi mật khẩu" : "Đổi mật khẩu"}
                                disabled={loading}
                                className="btn btn-primary"
                                style={{ width: "100%", justifyContent: "center" }}
                            >
                                {loading ? (
                                    <Loader2 className="animate-spin" size={18} />
                                ) : (
                                    <>
                                        <KeyRound size={16} />
                                        Đổi mật khẩu
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
