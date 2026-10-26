"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import styles from "./login.module.css";

export default function LoginPage() {
    const router = useRouter();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        const res = await signIn("credentials", {
            username,
            password,
            redirect: false,
        });

        if (res?.error) {
            setError("Sai tài khoản hoặc mật khẩu");
            setLoading(false);
        } else {
            router.push("/");
            router.refresh();
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

                {error && <div className={styles.error}>{error}</div>}

                <form onSubmit={handleSubmit} className={styles.form}>
                    <div className={styles.inputGroup}>
                        <label className="label-base" htmlFor="username">Tài khoản</label>
                        <input
                            id="username"
                            type="text"
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
                        <input
                            id="password"
                            type="password"
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
