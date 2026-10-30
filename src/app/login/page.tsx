"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import PasswordInput from "@/components/PasswordInput";
import styles from "./login.module.css";

const LOGIN_UNAVAILABLE_MESSAGE = "Không thể đăng nhập lúc này. Vui lòng kiểm tra kết nối và thử lại.";

export default function LoginPage() {
    const router = useRouter();
    const submittingRef = useRef(false);
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [passwordVisible, setPasswordVisible] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (submittingRef.current) return;
        submittingRef.current = true;
        setPasswordVisible(false);
        setLoading(true);
        setError("");

        let navigating = false;
        try {
            const res = await signIn("credentials", {
                username,
                password,
                redirect: false,
            });

            if (res?.error) {
                setError("Sai tài khoản hoặc mật khẩu");
                return;
            }
            if (res?.ok !== true) {
                setError(LOGIN_UNAVAILABLE_MESSAGE);
                return;
            }
            router.push("/");
            router.refresh();
            navigating = true;
        } catch {
            setError(LOGIN_UNAVAILABLE_MESSAGE);
        } finally {
            if (!navigating) {
                submittingRef.current = false;
                setLoading(false);
            }
        }
    };

    return (
        <div className={styles.container}>
            <div className={`glass-panel ${styles.formContainer}`}>
                <div className={styles.logoArea}>
                    <div className={styles.logoIcon}>CM</div>
                    <div>
                        <h1 className={styles.title}>Đăng Nhập</h1>
                        <p className={styles.subtitle}>Hệ thống quản lý khách hàng</p>
                    </div>
                </div>

                {error && <div id="login-error" className={styles.error} role="alert">{error}</div>}

                <form onSubmit={handleSubmit} className={styles.form} aria-busy={loading} aria-describedby={error ? "login-error" : undefined}>
                    <div className={styles.inputGroup}>
                        <label className="label-base" htmlFor="username">Tài khoản</label>
                        <input
                            id="username"
                            type="text"
                            autoComplete="username"
                            autoCapitalize="none"
                            className="input-base"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            disabled={loading}
                            placeholder="Nhập tên đăng nhập..."
                        />
                    </div>

                    <div className={styles.inputGroup}>
                        <label className="label-base" htmlFor="password">Mật khẩu</label>
                        <PasswordInput
                            id="password"
                            visible={passwordVisible}
                            visibilityLabel="mật khẩu"
                            onToggle={() => { if (!submittingRef.current) setPasswordVisible((current) => !current); }}
                            autoComplete="current-password"
                            className="input-base"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            disabled={loading}
                            placeholder="Nhập mật khẩu..."
                        />
                    </div>

                    <button type="submit" className={`btn btn-primary ${styles.submitBtn}`} disabled={loading}>
                        {loading ? "Đang xử lý..." : "Đăng Nhập"}
                    </button>
                </form>
            </div>
        </div>
    );
}
