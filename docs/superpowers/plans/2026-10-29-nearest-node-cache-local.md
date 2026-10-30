# Nearest-node cache: dedupe và chống stale refill

> Tiếp Task 7/9 của roadmap đã duyệt; thực hiện local, không commit/push/deploy. Dùng debugging, TDD và review trước tích hợp. Không tạo nhánh hoặc database.

**Goal:** Các lượt tìm node gần nhất đồng thời chia sẻ một read trong cùng thế hệ cache; read cũ không tái nạp cache sau invalidation.

**Architecture:** Giữ mảng coordinate cache và TTL 5 phút hiện có. Thêm một pending promise và generation token riêng cho helper. Invalidation xóa cache, thay token và detach pending cũ; finally chỉ xóa pending đúng owner. Caller cũ vẫn có thể nhận snapshot cũ, nhưng không được ghi đè cache mới. Không đổi thuật toán Haversine, thứ tự tie, Prisma select, API/auth/UI hoặc lifecycle của shared KPI cache.

**Tech Stack:** TypeScript, Vitest, Prisma boundary giả; không libsql/native/database thật.

## Phạm vi file

- Sửa `src/lib/nodeUtils.ts`.
- Thêm `tests/unit/nearest-node-cache.test.ts`.
- Thêm `docs/nearest-node-cache.md`, plan này; cập nhật roadmap và mục 39 `tiendokpi.md`.
- Không sửa upload, backup, customer routes hoặc warnings không liên quan.

## Các bước và điểm dừng

- [x] Snapshot 429 union paths/331 source-config-test paths, inventories và 95 thay đổi local; hash 397 artifact cũ trước thí nghiệm, giữ nguyên HEAD/index.
- [x] Viết 18 test trước: cold burst, TTL boundary/expiry, empty/null-coordinate/tie, query failures/retry, invalidation với read cũ, old finally không xóa pending mới. Deferred có thể điều khiển; không dùng sleep hoặc deadline lớn hơn.
- [x] RED một lần trên source cũ: 10 semantic fail/8 pass đúng query-count/stale-result assertions, không phải import/setup error; giữ log.
- [x] Sửa tối thiểu single-flight + generation ownership trong helper; GREEN 18/18 và freeze source/test hashes trước review.
- [x] Mỗi root một lượt broader selection cũ + test mới: 35 file/592 test và policy22 đạt, full TypeScript đạt, ESLint 0 error/3 warning có sẵn. Không retry đến khi xanh; full-native Windows không chạy.
- [x] Review APPROVE đúng frozen pair; source có backup/hash/whitespace/default secret scan trước primary integration. `integrated-files.json` xác nhận phần docs/preservation cuối của tổng 6 file; kết quả lưu ở mục 39, không publish.

## Acceptance và giới hạn

- Burst giả 1/10/100 callers: cùng snapshot, tối đa một `prisma.node.findMany` trong cùng thế hệ, vẫn tính nearest riêng theo tọa độ caller.
- TTL tính từ read thành công; mốc bằng expiry vẫn hit như implementation cũ. Cache mảng rỗng hợp lệ; failure không poison cache, lần sau retry được.
- Old read success/failure không publish hoặc clear pending của thế hệ mới. Không hủy query/response cũ và không đảm bảo snapshot linearizable hoặc liên process.
- Chỉ chứng minh read-count/độ đúng với dữ liệu giả, không claim latency, SQL toàn API, throughput, page-load hoặc hết timeout KPI cũ. Native/visual/Node0TB timing/performance/release gates vẫn mở.
- Không build/browser benchmark trong lát cắt helper-only local này; build/release cần kiểm tra riêng sau khi owner cho phép.
