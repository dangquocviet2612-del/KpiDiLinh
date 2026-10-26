"use client";

import { useState } from "react";
import { KeyRound, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import styles from "../customers/customers.module.css";

export default function ChangePasswordPage() {
    const [formData, setFormData] = useState({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
    });
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        setMessage(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
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

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Có lỗi xảy ra");
            }

            setMessage({ type: "success", text: "Đổi mật khẩu thành công!" });
            setFormData({ currentPassword: "", newPassword: "", confirmPassword: "" });
        } catch (err: any) {
            setMessage({ type: "error", text: err.message });
        } finally {
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
                <form onSubmit={handleSubmit} style={{ maxWidth: "450px" }}>
                    {message && (
                        <div
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
                            <label className="label-base">Mật khẩu hiện tại *</label>
                            <input
                                name="currentPassword"
                                type="password"
                                required
                                className="input-base"
                                value={formData.currentPassword}
                                onChange={handleChange}
                                placeholder="Nhập mật khẩu hiện tại"
                            />
                        </div>

                        <div>
                            <label className="label-base">Mật khẩu mới *</label>
                            <input
                                name="newPassword"
                                type="password"
                                required
                                minLength={6}
                                className="input-base"
                                value={formData.newPassword}
                                onChange={handleChange}
                                placeholder="Tối thiểu 6 ký tự"
                            />
                        </div>

                        <div>
                            <label className="label-base">Xác nhận mật khẩu mới *</label>
                            <input
                                name="confirmPassword"
                                type="password"
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
