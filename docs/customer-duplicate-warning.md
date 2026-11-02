# Cảnh báo khách hàng nghi trùng

Khi tạo khách hàng từ form thường hoặc dán nhanh, POST kiểm tra lại khách hàng trong phạm vi quyền xem. Account trùng vẫn bị chặn theo kiểm tra hiện có.

- Tên chuẩn hóa Unicode NFC, hoa/thường và khoảng trắng. Cùng tên và khoảng cách Haversine không quá 300m tạo cảnh báo. Thiếu tọa độ cũng cảnh báo cùng tên, ghi rõ không tính được khoảng cách.
- SĐT chuẩn hóa số và đầu +84/0; SĐT trùng tạo cảnh báo dù khác tên/khoảng cách.
- Cảnh báo không ghi dữ liệu. Người dùng xem bản hiện có ở tab mới, quay lại kiểm tra hoặc nhập lý do 5–500 ký tự để thêm riêng.
- Xác nhận chứa các ID đã xem; server tính lại danh sách trước khi chấp nhận. Thay dữ liệu trong form làm mất hiệu lực xác nhận cũ.
- Override ghi audit qua helper hiện có sau tạo; audit best-effort, không phải transaction nguyên tử. Kiểm tra và tạo chưa có unique constraint mới: hai yêu cầu đồng thời vẫn có thể race.
- Không gộp/xóa khách hàng cũ, không đổi schema và không cho vượt phạm vi quyền.

Local verification 02/11/2026: 117 file/2.011 tests đạt, production build đạt. Phần cảnh báo chưa phát hành ở thời điểm tạo tài liệu.
