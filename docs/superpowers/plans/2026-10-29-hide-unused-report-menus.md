# Bỏ menu CDT tồn và Rời mạng

**Yêu cầu owner:** Hai mục không dùng, bỏ khỏi menu. Chỉ local, chưa push/deploy.

**Phạm vi:** Gỡ link Tồn CDT và Rời mạng trong Sidebar dùng chung desktop/mobile; gỡ cả hai shortcut Tồn CDT trên trang CDT và callback/prop không còn sử dụng. Giữ nguyên CDT thường, Nguy cơ rời mạng, trạng thái khách hàng, chỉ tiêu KPI rời mạng, các URL cũ, API và dữ liệu. Đây là ẩn entry point, không phải xóa tính năng hoặc phân quyền mới.

- [x] Dừng tối ưu COUNT CDT tồn đang dở theo đổi hướng của owner: giữ private candidate/RED/GREEN, restore đúng worktree preimage, xóa riêng test tạm đã kiểm hash; không tích hợp vào primary.
- [x] Snapshot 432 paths/332 source-config-test paths/99 thay đổi có sẵn/442 artifact cũ và viết regression cho 3 role: desktop/mobile Sidebar không còn link cũ, CDT không còn cả hai nút Tồn CDT, chức năng còn lại vẫn dùng được.
- [x] RED-count9 vì entry còn tồn tại → GREEN9; xóa đúng các entry và prop/callback thừa, không sửa hooks/API/schema/loader của các URL cũ. Giữ RED đầu có query ambiguity và type failure của test, sửa thành queryAll + anchored name regex, không nới assertion.
- [x] Worktree V2 và primary mỗi nơi 36 file/601 scoped test +22 policy và TypeScript đạt, lint 0 error/3 warning cũ. Review APPROVE đúng final4hashes; backup/hash/whitespace/default secret scan trước source integration. `integrated-files.json` xác nhận phần docs/preservation cuối của tổng7file, mục40 lưu tiến độ. Không tăng timeout, commit/push/deploy hoặc claim full suite/build/browser acceptance.

Các URL cũ vẫn mở được nếu gõ trực tiếp; không phải cách chặn truy cập hoặc thu hồi quyền. Chỉ bỏ menu theo yêu cầu; nếu cần gỡ hẳn module/API/dữ liệu phải làm riêng. Không claim cải thiện tốc độ, pixel/mobile-device QA, full-native hoặc release acceptance từ thay đổi này.
