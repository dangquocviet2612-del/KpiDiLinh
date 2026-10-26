"use client";

import { useEffect } from "react";
import AsyncState from "@/components/ui/AsyncState";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("DASHBOARD_ERROR_BOUNDARY", error);
  }, [error]);

  return (
    <AsyncState
      status="error"
      title="Không thể tải dữ liệu trang này"
      description="Đã có lỗi khi truy vấn máy chủ. Bạn có thể thử tải lại hoặc chọn chức năng khác từ menu."
      actionLabel="Thử lại"
      onAction={reset}
    />
  );
}
