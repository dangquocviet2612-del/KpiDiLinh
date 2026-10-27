# Cache correctness — local batch 5

**Ngày:** 27/10/2026. Slice đầu Task 7 của roadmap đã duyệt. Base primary `5193010`; tái sử dụng checkout tách riêng có cùng app source dù HEAD checkout vẫn là `1ecfa38`. Không reset checkout hoặc tạo branch/commit.

**Goal:** Sửa các lỗi invalidation tái hiện được sau import/cấu hình cước, upload node, user mutation và restore; giới hạn cache in-memory, giữ công thức/phân quyền/API contract hiện tại.

**Architecture:** Một dependency matrix typed trong `src/lib/cache-tags.ts` gọi API clear-prefix hiện có; mutation invalidate sau write/transaction đã commit, kể cả một phần của import sau đó trả 500. CUOC xóa cả report/summary và helper prepaid; node upload xóa thêm `node:search` và customer caches vì mapping sync ghi Customer.nodeName; user mutation và restore xóa toàn bộ store kpi-cache trong process. `kpi-cache.ts` giữ ba export cũ, thêm cap 1.000 entry/LRU và prune expired, TTL không hợp lệ/không dương không lưu, thời điểm hết TTL là miss. Rowwise node efficiency phải đợi allSettled và clear sau mỗi chunk có write thành công; mapping helper có optional commit callback giữ nguyên DML/API caller cũ; user fallback có partial-write cleanup, không đổi atomicity/business semantics.

**Không nằm trong slice này:** shared version/invalidation nhiều instance, single-flight/in-flight stale refill, thay JWT/session/password hoặc SLA thu hồi quyền. JWT hiện giữ role từ login; không được gọi việc clear cache là đã sửa session revocation. Không thêm Redis/provider/migration/schema để giả vờ hoàn thành Task 7. Cần thiết kế/rollout riêng cho các mục này.

**Guardrails:** Chỉ fixture giả có thư mục được quản lý, không đọc env/database phục hồi, không Turso/Vercel hoặc sản xuất. Không commit/push/deploy. Snapshot hash trước sửa/tích hợp, giữ lịch sử migration và các tính năng công thức/restore safeguard. Không dùng retry/ignore để che lỗi native Windows từng ghi nhận.

- [x] Snapshot nguồn và xác nhận các cache key/dependency thực tế; ghi phạm vi và gaps phân quyền.
- [x] TDD core cache: LRU/cap, TTL boundary, prune và clear-prefix; ghi RED trước implementation.
- [x] TDD mutation regression trên SQLite/Prisma giả: CUOC import/config, node upload, user scope và restore; 401/403/full rollback/no-write không invalidate, partial commit được clear.
- [x] Dependency matrix và handler wiring sau từng commit; giữ cache ngoài dependency khi hợp lý, restore clear store; no-op User PUT không clear dù audit vẫn ghi.
- [x] Full tests/policy/types/lint/build fixture, native browser smoke và review/secret scan; không suy diễn multi-instance hoặc cloud latency.
- [x] Tích hợp sau hash-check hai checkout có base khác nhau, cập nhật tiến độ/Task 7 partial và hạn chế còn lại.

**Checkpoint:** Primary đã tích hợp 17 file sau hash-check và backup; full suite tại primary và checkout cùng đạt 56 file / 572 test + 22 policy test, TypeScript/lint đạt (3 warning cũ). Build fixture đạt, 33 API hashes khớp và 10 browser cases đạt; hash SQLite giả vẫn bằng trước build sau khi dừng preview riêng. Secret scan trên tập tích hợp không phát hiện secret; chưa commit/push/deploy hoặc thao tác database thật. Các gap JWT/shared invalidation/in-flight nêu trên vẫn pending ở roadmap.
