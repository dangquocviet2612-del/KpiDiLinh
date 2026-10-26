"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("ROOT_ERROR_BOUNDARY", error);
  }, [error]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        padding: "2rem",
        textAlign: "center",
        background: "var(--background)",
        color: "var(--foreground)",
      }}
    >
      <div
        style={{
          width: "80px",
          height: "80px",
          borderRadius: "50%",
          background: "rgba(239, 68, 68, 0.12)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "1.5rem",
          color: "var(--destructive)",
        }}
      >
        <AlertTriangle size={44} />
      </div>

      <h1 style={{ fontSize: "2rem", fontWeight: 700, margin: "0 0 0.5rem" }}>
        Đã Xảy Ra Lỗi Hệ Thống
      </h1>

      <p
        style={{
          fontSize: "1rem",
          color: "var(--secondary-foreground)",
          maxWidth: "500px",
          margin: "0 0 1.5rem",
          lineHeight: 1.6,
        }}
      >
        Rất tiếc, đã có sự cố không mong muốn xảy ra trong quá trình xử lý yêu cầu của bạn.
        {error.digest ? ` (Mã lỗi: ${error.digest})` : ""}
      </p>

      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", justifyContent: "center" }}>
        <button
          onClick={() => reset()}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.75rem 1.5rem",
            borderRadius: "var(--radius)",
            background: "var(--primary)",
            color: "var(--primary-foreground)",
            fontWeight: 600,
            border: "none",
            cursor: "pointer",
            boxShadow: "var(--shadow-md)",
          }}
        >
          <RefreshCw size={18} />
          Thử Lại
        </button>

        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.75rem 1.5rem",
            borderRadius: "var(--radius)",
            background: "var(--card)",
            color: "var(--foreground)",
            border: "1px solid var(--border)",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          <Home size={18} />
          Về Trang Chủ
        </Link>
      </div>
    </div>
  );
}
