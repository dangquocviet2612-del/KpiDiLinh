# Runtime schema và tracing — local batch 3

**Goal:** Thực hiện Task 4: GET không tạo/alter schema, seed config hoặc tự đọc/import Excel; chuyển definitions/default sang migration mới, giữ công thức/phân quyền và dữ liệu đã nhập.

**Thiết kế:** Giữ API các ensure helper nhưng đổi thành guard chỉ đọc, single-flight theo domain. Kiểm tra required columns/default-row existence thay vì yêu cầu ledger: database cũ đủ schema vẫn được đọc, nhưng không được tự adoption để chạy migration. Schema thiếu trả lỗi vận hành tường minh, không âm thầm sửa. Readiness không phải xác nhận migration provenance.

**Guardrails:** Chỉ fixture mới/managed, không đọc env hay database thật; không chạy adoption/migration trên SQLite phục hồi/Turso. Không commit/push/deploy. Không bỏ default `CUOC_N1_N3_RATE`, không đổi target config đã chỉnh, không sửa SQL lịch sử. Auto Excel seed trên GET được thay bằng import UI/API quản trị đã có, không mất dữ liệu đã nhập.

- [x] Inventory runtime columns/index/default so với catalog 4 migration, tạo migration mới đủ phần còn thiếu trên fixture.
- [x] TDD guard chỉ SELECT/read, memoize thành công và reset khi lỗi; missing schema/default fail rõ ràng; cả fresh migrated và adequate untracked fixtures không ghi trên request.
- [x] Đổi ensure KPI/customer/users/Node0TB; xác thực trước schema check ở user/customer entry points, không schema writes trước auth.
- [x] Bỏ GET auto-sync/default filesystem loader ở cước CĐ và Node0TB; giữ parser/upload/matching/stats, loại import-path filesystem tracing thay vì suppress warnings.
- [x] Verify cold request SQL counts, 3 role, import regression, native browser trên fixture; tests/types/lint/build/tracing, secret scan và review.
- [x] Tích hợp sau đối chiếu hash, cập nhật `tiendokpi.md` và giới hạn rollout. Adoption/multi-region/real DB vẫn là checkpoint riêng.

## Kết quả local, 27/10/2026

- 39 file batch 3 tích hợp sau kiểm tra hash đích, giữ nguyên các batch trước; có bản lưu trước tích hợp riêng tư. Không commit/push/deploy hoặc đọc/migrate dữ liệu thật.
- Tại thư mục chính: 50 file / 398 test, 22 policy test, TypeScript đều đạt; lint 0 error / 3 warning cũ. Build fixture đạt, 0 broad tracing warning, SQLite giả không đổi.
- 27 response golden/status qua 3 role khớp; 6 lượt Chrome desktop/mobile không lỗi JS, mỗi calculator 1 report. GET không đổi schema/dữ liệu fixture.
- Review đã đóng lỗi UNIQUE đảo thứ tự cột và UNC trước filesystem. Restore legacy backup thiếu default có kiểm tra actual Prisma transaction, giữ cấu hình và rollback khi lỗi.
- Secret scan default trên tập file tích hợp không tìm thấy secret. Hướng dẫn: `docs/runtime-schema.md`; tiến độ và backlog: mục 18 của `tiendokpi.md`.
