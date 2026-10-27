# Migration Safety & Critical Dependencies — Local Batch 2

**Goal:** Tiếp tục Task 3 của plan UX/performance: chặn migration replay, kiểm thử transaction trên database giả và vá dependency critical bằng phiên bản tương thích. Chỉ local; không commit/push/deploy hoặc chạm database thật.

**Thiết kế đã chọn:** Giữ SQL migration lịch sử; thêm ledger checksum SHA-256 chuẩn hóa line endings và transaction write theo từng version. Check là mặc định chỉ đọc; apply phải tường minh. Database đã có bảng nhưng chưa có ledger bị từ chối trước mọi ghi, không tự baseline. Hai lựa chọn không dùng: tự đánh dấu applied dựa vào tên bảng (không chứng minh schema/data) hoặc viết lại toàn bộ lịch sử sang provider khác (ngoài scope).

Baseline/adoption database phục hồi là checkpoint riêng: cần snapshot, so schema/index/default/foreign keys, đối chiếu content checksum trước/sau và owner duyệt manifest theo đúng database. Batch này thiết kế checklist, không cung cấp nút tự chấp nhận database cũ.

## Các bước

- [x] TDD: `--check` không tạo schema/ledger; apply từ chối database untracked mà không đổi dữ liệu; fresh/apply lại, checksum drift, rollback rebuild và hai runner được kiểm tra trên fixture. Thêm guards literal sqlite_ prefix, memory/empty targets sau review.
- [x] Tạo `scripts/lib/migration-runner.mjs`, `scripts/release-migrations.mjs`; chuyển `scripts/migrate.mjs` thành wrapper tương thích an toàn. Không auto-load `.env`, không log URL/token/SQL; remote cần opt-in riêng.
- [x] Vá Next/NextAuth và dependency tương ứng sau xác minh advisory/compatibility; không mass upgrade hoặc force override. Audit local không còn critical, vẫn còn high. Node CI/types 24 khớp Vitest 5, không dùng legacy peer flag.
- [x] Test/type/lint/build và Chrome 3 role/desktop/mobile/archive trên database giả đạt; SQL lịch sử không đổi. Production và SQLite phục hồi không tham gia. Secret scan và tích hợp được ghi ở checkpoint tiến độ.
- [x] Review và sửa findings (literal sqlite_ prefix, memory/empty filename guards); tích hợp 16 file sau kiểm tra hash đích, đối chiếu byte với checkout đã build. Chạy lại tại thư mục chính: 46 file/293 test, 22 policy test, types/lint đạt; scan được review chỉ allow đúng fixture CI cũ. Cập nhật progress/docs; không commit/push/deploy. Giữ Task 4 runtime DDL và UI/map trong backlog.

**Chưa hoàn thành Task 3 end-to-end:** verified adoption trên bản phục hồi/anonymized, backup chứa ledger, online read-only credential và release/rollback drill vẫn là checkpoint riêng. Không tự chạy migration/baseline trên dữ liệu thật.
