import Link from "next/link";
import { FileQuestion, Home } from "lucide-react";

export default function NotFound() {
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
          background: "rgba(15, 118, 110, 0.12)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "1.5rem",
          color: "var(--primary)",
        }}
      >
        <FileQuestion size={44} />
      </div>

      <h1 style={{ fontSize: "2.5rem", fontWeight: 700, margin: "0 0 0.5rem" }}>
        404 - Không Tìm Thấy Trang
      </h1>

      <p
        style={{
          fontSize: "1.05rem",
          color: "var(--secondary-foreground)",
          maxWidth: "460px",
          margin: "0 0 2rem",
          lineHeight: 1.6,
        }}
      >
        Đường dẫn bạn yêu cầu không tồn tại hoặc đã được chuyển sang vị trí khác.
        Vui lòng kiểm tra lại địa chỉ hoặc quay về trang chủ.
      </p>

      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", justifyContent: "center" }}>
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.75rem 1.5rem",
            borderRadius: "var(--radius)",
            background: "var(--primary)",
            color: "var(--primary-foreground)",
            fontWeight: 600,
            textDecoration: "none",
            boxShadow: "var(--shadow-md)",
            transition: "opacity 0.2s ease",
          }}
        >
          <Home size={18} />
          Về Trang Chủ
        </Link>
      </div>
    </div>
  );
}
