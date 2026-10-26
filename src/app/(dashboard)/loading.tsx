import AsyncState from "@/components/ui/AsyncState";

export default function DashboardLoading() {
  return (
    <AsyncState
      status="loading"
      title="Đang tải dữ liệu"
      description="Hệ thống đang chuẩn bị nội dung mới nhất cho bạn."
    />
  );
}
