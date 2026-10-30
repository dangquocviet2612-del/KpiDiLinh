# Cước CĐ: cache ngày báo cáo mới nhất

**Goal:** Tiếp Task 10, bỏ lượt đọc latest-date lặp trước response-cache hit, không đổi số liệu/role filters hoặc UI. Giữ menu Tồn CDT/Rời mạng đã ẩn và dừng tối ưu các màn hình đó.

**Architecture:** Thêm metadata key `cuoc-cd:report:latest-date` trong cache hiện có, TTL 30 giây kể từ read thành công, kể cả chuỗi rỗng. Dùng generation token capture trước auth, namespace nằm dưới prefix invalidation hiện có của import/config. Chỉ lookup khi request không chỉ định ngày, sau auth/role/readiness/scope như trước. Response-cache key/TTL60giây và mọi SQL/filter/rounding giữ nguyên.

**Tech Stack:** TypeScript/Vitest, real route/cache/SQL trên SQLite `:memory:` qua Node builtin; Prisma/auth/scope/readiness boundary giả. Không libsql, .env hoặc database thật.

## Phạm vi

- Sửa `src/app/api/cuoc-cd/report/route.ts`; thêm `tests/unit/cuoc-cd-latest-date.test.ts`.
- Thêm guide `docs/cuoc-cd-latest-date.md`, plan này; cập nhật roadmap và mục41 `tiendokpi.md`.
- Không sửa import/config, auth/scope, SQL row fetching, KPI/cước formulas, schema/index, UI hoặc feature khác.

## Checklist

- [x] Snapshot434 paths/333 source-config-test paths/103 thay đổi local và hash488 artifact cũ, giữ HEAD/index.
- [x] RED18 semantic fail/3pass trước code: cold/warm/empty/latest metadata, TTL30s, explicit-date bypass, 3role payload, namespace invalidation/late generation/error retry và auth fail-closed; SQLite bộ nhớ/explicit close, không sleep/tăng deadline.
- [x] GREEN21/21 với code tối thiểu; freeze source/test hash, review APPROVE đúng final pair. Cả5SQL expressions/params nguyên byte, response TTL60s không đổi.
- [x] WT V1 scoped/policy/types đạt nhưng lint bắt helper test tên useRole; chỉ rename thành setSessionRole, giữ nguyên logic/assertions và artifacts V1. WT V2 và primary mỗi nơi38file/628test+22policy/types đạt, lint0error/3warning cũ. Không retry unchanged code để ép xanh.
- [x] Source backup/hash/whitespace/default secret scan trước primary integration. `integrated-files.json` xác nhận docs/preservation cuối của tổng6file; progress41 ghi kết quả thật, preserve103thay đổi/488artifact cũ. Không commit/push/deploy.

## Acceptance và giới hạn

- Latest request cold có dữ liệu vẫn4 report SELECT; same-response warm 1→0 report SELECT; khác role với metadata warm/report miss 4→3. Explicit date vẫn3 SELECT; scope/auth/readiness có thể có reads riêng ngoài số này.
- Empty latest được negative-cache30s; import/config clear prefix phủ cả response và metadata trong cùng cache-store/module instance. Write trực tiếp sau khi cache đã fill có thể chờ phần TTL còn lại (tối đa30s từ completion) để thấy ngày mới. Không có hard freshness bound nếu write xen giữa read đang chờ hoặc nhiều instance; đây là freshness contract mới, không claim identical uninvalidated-write behavior.
- Global latest date giữ semantics cũ, không phải latest theo role. Rows vẫn lọc/cached riêng như trước; không dùng metadata để bypass auth hoặc chia sẻ response của role khác.
- Không single-flight, distributed cache, snapshot linearizability, SQL scope pushdown hoặc latency/EXPLAIN/RUM acceptance. Không giải quyết KPI timeout/native/oldvisual/Node0TB timing/release gates. Không fresh build/browser claim cho lát cắt local này.
