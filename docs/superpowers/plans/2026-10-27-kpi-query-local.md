# KPI query critical path — local batch 4

**Ngày:** 27/10/2026. Tiếp tục phần local của Task 6 trong roadmap đã được duyệt, không đổi giao diện, công thức, scope hoặc TTL/cache policy.

**Thiết kế:** Gộp hai lượt đọc metadata cấu hình summary thành một query chỉ lấy field cần dùng; SQL sắp xếp theo sortOrder/group để giữ nguyên thứ tự nhóm, chỉ dedupe raw group trước trim. Giữ truy vấn JOIN/GROUP BY dữ liệu KPI. Sau auth/scope/date/cache miss, personal report đọc rows/target/cước song song; summary cước đọc target và dữ liệu cùng ngày song song, giữ nguyên fallback toàn scope. Không đưa private reads lên trước kiểm tra quyền hoặc thay đổi cache scope.

**Chọn hướng:** Chạy song song/giảm round-trip với cùng payload trước; chưa thêm data cache hoặc Redis vì cần revocation/invalidation riêng của Task 7; không pin region/thêm index khi chưa đo cloud. SQL templates dùng chung giữa route và EXPLAIN để tránh tool đo nhầm câu lệnh.

**Guardrails:** Chỉ fixture giả do test quản lý. Không đọc env/database phục hồi, không Turso/production, không migration/adoption dữ liệu thật. Giữ các batch 1–3 và mọi thay đổi local khác; snapshot/hash trước tích hợp. Không commit/push/deploy, không thêm provider/dependency hoặc sửa công thức làm tròn/KPI âm/cước.

- [x] Snapshot nguồn; characterization native Prisma payload/status theo 3 role và các nhánh ngày/nhóm/cước/empty/negative.
- [x] TDD scheduling/metadata budget: test thấy RED ở thứ tự query cũ và metadata lặp, auth/early-return không đọc thừa.
- [x] Chạy query độc lập song song và hợp nhất metadata; golden giữ nguyên payload, cache và scope.
- [x] Tool EXPLAIN chỉ đọc, target local tường minh; test thiếu target/file/remote/UNC và đo fixture nhỏ/lớn, không sửa index theo cảm tính.
- [x] Full tests/policy/types/lint/build trên fixture, native Chrome desktop/mobile, review spec/security và secret scan.
- [x] Tích hợp có đối chiếu hash, xác minh tại thư mục chính, cập nhật tiến độ và backlog. Cloud benchmark, Task 7 cache/revocation và bundle/map vẫn là checkpoint riêng.

## Kết quả, 27/10/2026

- 13 file tích hợp có đối chiếu hash; giữ nguyên các batch trước và lưu file trước thay đổi riêng tư. Không commit/push/deploy hoặc thao tác dữ liệu thật.
- 53 file / 504 test + 22 policy test đạt tại thư mục chính; TypeScript/scoped lint/build fixture đạt, lint app 0 error / 3 warning cũ, 0 broad tracing warning.
- 63 golden status/body hashes từ source trước batch; 33 HTTP responses và 10 Chrome cases calculator/summary desktop/mobile giữ kết quả, không đổi SQLite giả.
- Metadata summary 2→1; tổng logical reads sau mock auth cold 6→5 cho ADMIN/MANAGER trên fixture, warm0. Không kết luận tốc độ cloud.
- EXPLAIN 39 test: readonly native open, race/missing/remote/UNC, bound params và raw-stderr redaction, không suppress warning. Review spec/quality đã đóng findings; secret scan default không phát hiện secret.
- Có 1 lần child process của test migration cũ thoát 0xC0000005. 3 lượt target 26/26 và full-suite cuối đạt; chưa xác định nguyên nhân native, không thêm retry/ignore. Theo dõi trong mục 19 `tiendokpi.md`, không coi lỗi đã được sửa.
