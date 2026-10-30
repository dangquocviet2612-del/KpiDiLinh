# Cache node gần nhất: gộp read và chặn stale refill

29/10/2026 — lát cắt local của Task 7/9, nối tiếp mục 38. Không đổi giao diện hoặc công thức khoảng cách; chưa publish.

## Đường đi nghiệp vụ

`customers POST / customers [id] PUT / resolvePreferredCustomerNodeName`
→ `findNearestNodeName(latitude, longitude)`
→ cache tọa độ trong process
→ `prisma.node.findMany({ select: { name, latitude, longitude } })`
→ Haversine chọn tên node gần nhất cho riêng từng tọa độ caller.

Đây là fallback tự tìm node khi luồng nghiệp vụ cần nó; không phải mọi lần mở bản đồ đều gọi helper này. Upload node và restore backup đã có caller `invalidateNearestNodeCache`; checkpoint này không sửa các route đó hoặc thay đổi phân quyền.

## Hai vấn đề đã tái hiện

1. **Cold/expired reads đồng thời chưa được gộp:** mỗi caller thấy cache rỗng và tự bắt đầu `findMany`. Với deferred read giả và 10/100 caller, bản cũ gọi boundary 10/100 lần thay vì 1. Mỗi caller vẫn phải tính khoảng cách riêng; không cache một tên nearest dùng chung cho mọi vị trí.
2. **Read cũ có thể tái nạp cache sau invalidation:** read A đang chờ, cache bị invalidated rồi read B đã lấy snapshot mới; khi A hoàn tất muộn, bản cũ ghi đè cache bằng snapshot cũ trong tối đa TTL 5 phút. Test đảo thứ tự completion tái hiện đúng kết quả cũ không mong muốn.

## Cách sửa và hợp đồng giữ nguyên

- Một promise pending chỉ chia sẻ **read tọa độ** trong cùng thế hệ/process. Kết quả array dùng chung nhưng từng lời gọi chạy Haversine riêng như trước.
- Capture `Symbol` generation trước database await; chỉ publish cache và expiry nếu generation vẫn hiện hành.
- Invalidation xóa cache/expiry, đổi token và detach pending cũ. Finalizer của read cũ chỉ được xóa pending nếu còn giữ đúng identity; không xóa promise của thế hệ mới.
- Failure được truyền cho waiter, không cache/reuse rejected promise. Lượt tiếp theo có thể retry.
- Giữ projection 3 field, thứ tự dữ liệu, filter bỏ null coordinates, nhận tọa độ 0, first-row tie và TTL 5 phút tính từ completion thành công. Mốc `now === expiry` vẫn hit, chỉ refresh khi `now > expiry`; array rỗng vẫn là cache hợp lệ.
- Không thêm query/write/schema/index, dependency, timer, auth, API payload hoặc UI change.

## Kiểm chứng

`tests/unit/nearest-node-cache.test.ts` chạy helper thật, mock **chỉ Prisma boundary**; điều khiển deferred promises và Date, không sleep hoặc tăng timeout.

- **RED:** 18 case, 10 semantic failure/8 pass trên helper cũ; lỗi đúng read count hoặc stale result, không phải setup/import error.
- **GREEN:** 18/18 với helper mới, bao gồm burst 1/10/100, warm/expired/empty snapshots, TTL boundary/from completion, null/zero/tie, shared error/retry/sync throw, invalidation và old resolve/reject không phá pending mới.
- Cold burst fixture: **1→1, 10→1, 100→1 lượt gọi `findMany`**. Đây là boundary-call count trên dữ liệu giả, không phải số SQL toàn API, database throughput hoặc thời gian tải web thực.
- Broad selection cho mỗi root chốt một lần: 13 unit filters + `tests/ui` (35 file, 592 case), cùng policy22, full TypeScript và ESLint src + test. Kết quả cuối ghi ở mục 39 `tiendokpi.md` và evidence private, không retry để ép xanh.

**Kết quả cuối:** Worktree và primary chạy độc lập, mỗi nơi **35/35 file, 592/592 test + 22/22 policy đạt**; TypeScript nonincremental đạt, lint 0 error/3 warning có sẵn. Không cộng hai lượt thành số testcase khác nhau hoặc gọi scoped selection là full suite. Bản source/test đã được review đúng frozen hashes trước source integration; backup/whitespace/default secret scan và preservation có manifests riêng. Không có fresh build/browser/real-database performance acceptance.

Frozen SHA-256:

| File | Hash |
| --- | --- |
| `src/lib/nodeUtils.ts` | `99d1f356f138103e4175082edcf7c676fb6fd8f31c1cf8cd77bc8ad6cbb42c3a` |
| `tests/unit/nearest-node-cache.test.ts` | `2b2abd2aba8088e60b40cbe49db0237feb1482596dc438b7cca883c5cc6d3d92` |

## Giới hạn

- Old caller vẫn có thể nhận snapshot cũ; chỉ chặn nó republish cache hoặc clear pending mới. Không cancel query/response, không snapshot linearizability hoặc sửa write đang thực thi.
- Chỉ trong một process/module instance, không dedupe nhiều Vercel instance, thay thế shared cache, JWT/revocation hoặc sửa thiếu invalidation từ nơi chưa gọi helper.
- Pending read chưa settle có thể giữ các waiter cùng thế hệ; không thêm deadline hay fallback, tiếp tục dùng behavior/timeout của database hiện có. Invalidation cho phép thế hệ mới bắt đầu read riêng.
- Không thay nearest calculation complexity hoặc giảm mọi query của luồng create/update/import. Chưa benchmark latency, page-load, RUM/p95 hay database thật.
- Không chạy full-native Windows suite, rebuild hoặc browser benchmark trong lát cắt helper này. Build trước đó không phải build của candidate mới; release/build acceptance vẫn cần kiểm tra riêng. Không sửa dependency hoặc chạy audit mạng.
- Timeout KPI cũ, native crash, strict visual bản đồ, Node0TB timing uncertainty và các phần còn lại roadmap vẫn mở. Đợt này không sửa ba lint warning đã có.

Evidence private `.local/performance/nearest-node-cache-20261029/`: preimage/snapshot, RED/GREEN, frozen hashes, review/QA, backups/scans và integration manifest. Không commit env, database, log, credentials hoặc business data.
