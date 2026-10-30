"use client";

import AsyncState from "@/components/ui/AsyncState";

export default function PrepaidError() {
  return (
    <AsyncState
      status="error"
      title="Không thể tải báo cáo"
      description="Tải lại toàn bộ trang để tải lại báo cáo. Bản nháp tính KPI chưa lưu sẽ bị xóa."
      actionLabel="Tải lại trang"
      onAction={() => window.location.reload()}
    />
  );
}
