# Task11: form đổi mật khẩu an toàn khi đang gửi

**Goal:** Chặn gửi trùng/sửa trường trong lúc PUT đang chờ, bổ sung labels/autocomplete/live feedback và xử lý phản hồi lỗi không rõ ràng. Giữ CSS/bố cục/API/chính sách hiện có, chỉ local.

**Architecture:** Ref guard đồng bộ, disabled fields + guard change khi pending, try/finally release sau response đã settle. Giữ validate6ký tự và confirm, body PUT hai field verbatim. Success cần đúng HTTP200 cùng message JSON đúng dạng và không có error như endpoint hiện tại; 4xx string error giữ thông báo API. Network/JSON/5xx/unknown outcome dùng copy cố định không khẳng định mutation chưa xảy ra, nhắc xác minh đăng nhập trước khi gửi lại. Không auto-retry.

**Tech Stack:** React/RTL/Vitest jsdom, fetch mock; không đổi mật khẩu thật hoặc gọi API/network/DB thật.

## Files

- Sửa `src/app/(dashboard)/change-password/page.tsx`.
- Thêm `tests/ui/change-password-feedback.test.tsx`, guide `docs/change-password-feedback.md`, plan này; cập nhật roadmap/mục44.
- Không sửa `/api/change-password`, auth/bcrypt/session/JWT/revocation, policy6ký tự, menus, iframe hoặc CSS.

## Checklist

- [x] Snapshot440paths/335source-config-test paths/preimage/inventory/110thay đổi và hash599artifact cũ; giữ HEAD/index.
- [x] Corrected RED23case19fail/4pass trước code, giữ RED đầu có fixture table mismatch; labels/autocomplete/POST fallback, pending fields/guard, duplicate, min/confirm, success/4xx/retry, unknown/network/JSON/5xx và verbatim credentials đều có coverage.
- [x] CoreGREEN23, status-contract201/202 RED2fail23pass→finalGREEN25/25; freeze source/test, review APPROVE exact pair. Không auto-retry/timeout hoặc sửa server policy.
- [x] WT/primary chạy riêng mỗi nơi40file/667scoped test+22policy/types đạt, lint0error/3warning cũ; không native full suite hoặc ép xanh bằng skip/deadline.
- [x] Source backup/hash/whitespace/default secret scan trước primary integration. `integrated-files.json` xác nhận docs/preservation cuối của tổng6file, tiến độ44 lưu kết quả thật, giữ110thay đổi/599artifact cũ. Không commit/push/deploy.

## Giới hạn

- Promise chưa settle vẫn pending, không cancel/timeout hoặc bảo đảm cross-tab/backend idempotency. Phản hồi không xác nhận không có nghĩa server chưa đổi; UI khuyên kiểm tra đăng nhập trước khi gửi lại.
- Native form fallback chỉ đặt method POST để tránh tên/mật khẩu trong URL GET nếu JS không chạy; không cung cấp native POST password-change flow (API vẫn PUT).
- Client tests không real auth/session revocation/password-manager/browser mobile hoặc pixel acceptance. Iframe và các phần Task11/Task10 khác, native/KPI-timeout/oldvisual/Node0TB timing/release còn mở.
