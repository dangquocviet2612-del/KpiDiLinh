# Cache correctness — local batch 5

Ngày **27/10/2026**, tiếp tục phần đầu Task 7 sau source `5193010`. Chỉ sửa và kiểm thử local, không push/deploy, không đọc env/database phục hồi hoặc kết nối Turso/Vercel thật.

## Những lỗi được xử lý

| Mutation thành công | Trước đây còn stale | Invalidation mới trong cùng process |
|---|---|---|
| Import cước hoặc lưu target cước | `kpi:summary` có thể trả payload cũ trước khi đọc config/helper đã refresh | `cuoc:`, `kpi:`, `prepaid:` |
| Upload/thay/xóa node theo flow hiện có | Reader dùng `node:search`, trong khi invalidation chỉ có `nodes:`; mapping còn ghi Customer.nodeName | `node:`, `nodes:`, `map:`, `customers:` |
| Tạo/sửa/xóa tài khoản | Có thể bỏ sót private customer/map/report cache phụ thuộc scope | Xóa toàn bộ store kpi-cache trong process |
| Restore backup | Bỏ sót users/scope/prepaid/customers/node search và prefix mới | Xóa toàn bộ store kpi-cache trong process |

`src/lib/cache-tags.ts` là dependency matrix typed dùng `clearCacheByPrefix` hiện có; không phải Next cache tag, Redis hoặc cơ chế invalidation phân tán. Event name do handler truyền literal, không lấy trực tiếp từ request. Users/restore dùng prefix rỗng có chủ đích để không bỏ sót cache private mới trong store kpi-cache; không xóa JWT, rate limiter hoặc mọi memo của thư viện khác. Invalidate sau write/transaction đã commit; 401/403/validation fail hoặc rollback toàn bộ phải giữ nguyên cache. Nếu có commit một phần rồi HTTP 500, cache phải được làm mới theo dữ liệu đã ghi, không được coi mọi 500 đều chưa thay đổi dữ liệu.

Node efficiency ghi từng dòng, không có transaction toàn file: đợi toàn bộ promise trong chunk settle, invalidate khi có write thành công rồi mới báo lỗi. Mapping upsert/sync có các batch commit độc lập; optional callback sau mỗi write thành công làm cache mới kể cả batch/sync sau thất bại. User fallback có cleanup khi write đầu đã commit nhưng cập nhật sau thất bại. Không thêm DML, không đổi thành atomic import, không tuyên bố mọi import lỗi đều rollback; cải thiện atomic import vẫn thuộc Task 12. Không đổi công thức, phạm vi quyền hay restore default/safeguard.

User PUT rỗng hoặc fallback có `data: {}` chỉ đọc lại record, không được coi là đã ghi User. Tracker chỉ đánh dấu khi update có field và thành công hoặc raw UPDATE trả affected-row count > 0; raw update đầu commit rồi update sau lỗi vẫn phải clear. No-op giữ cache/User rows nhưng vẫn ghi audit theo hành vi cũ.

## Giới hạn cache in-memory

`src/lib/kpi-cache.ts` vẫn giữ `getCache`, `setCache`, `clearCacheByPrefix`, không đổi chữ ký để caller cũ tiếp tục hoạt động.

- Tối đa **1.000 entry/process**, loại entry ít dùng gần đây nhất khi vượt cap. Get thành công và ghi đè key làm mới thứ tự LRU, không kéo dài TTL khi đọc.
- Hết hạn ngay tại `now >= expiresAt`. TTL bằng 0/âm/NaN/Infinity không lưu và xóa giá trị cũ của key đó.
- Ghi cache dọn entry đã hết hạn trước khi eviction, tránh loại nhầm entry còn sống. Prefix clear giữ semantics cũ; prefix rỗng xóa tất cả.
- Cap theo **số entry**, không phải số byte; một payload lớn vẫn có thể tốn nhiều RAM. Prune mỗi write quét tối đa 1.000 entry; chưa khẳng định budget CPU/byte với workload Production.

Core regression có RED **8/12** trên code cũ, sau sửa **12/12** đạt; 4 test dependency matrix kiểm tra domain cần clear, cache ngoài dependency và users/restore clear cả key tương lai. Các bài này không dùng database hoặc credentials thật.

Mutation regression dùng Prisma/libSQL thật, chỉ mock auth: **52/52** case đạt, gồm XLSX/KML/KMZ, config, user reassignment/create/delete/restore, 401/403, no-write/no-op, rollback toàn bộ và partial commit. Baseline đầu 30 case có 14 fail/16 pass; baseline mở rộng 44 case có 24 fail/14 pass/6 pending rồi worker native crash `0xC0000005`. Các ca partial-write tập trung đã fail trước crash, nhưng đây **không phải một lượt RED hoàn tất**. Giữ nguyên evidence và hash-restoration, không retry/ignore để che lỗi. Sau sửa có GREEN 44/44; review no-op bổ sung có RED 5/52 rồi GREEN 52/52, không crash. Không coi điều này là đã xác định/sửa nguyên nhân native Windows.

## Điều chưa được giải quyết

1. **Không có shared version/invalidation giữa nhiều instance.** Mutation ở A không xóa Map của B; chưa triển khai SLA freshness cross-instance.
2. **Không có single-flight/generation cho loader đang chạy.** Request đọc bắt đầu trước mutation vẫn có thể ghi kết quả cũ trở lại cache sau invalidation. Không coi việc clear prefix là đã chặn race này.
3. **Không sửa JWT/session lifecycle.** Role/id/name vẫn lấy từ JWT theo code auth hiện tại; clear cache không thu hồi cookie của user đã bị đổi role, xóa hoặc đổi mật khẩu. Không coi role claim cũ là đã được server xác minh lại.
4. **Scope cache/key chưa có permission version/stable identity đầy đủ.** Test manager reassignment trong slice này chỉ chứng minh handler mutation xóa cache trong cùng process với session fixture giữ nguyên role, không chứng minh mọi tình huống thu hồi quyền.
5. **Source chưa tự được đưa lên GitHub/Vercel và database thật chưa preflight/adopt.** Không tự chạy release migration hoặc thay provider để vượt các checkpoint còn thiếu.

Phân tích chi tiết các gap còn lại: `docs/cache-permission-gaps.md`. Các dòng chưa tick của Task 7 vẫn là backlog; slice này không hoàn tất đợt 2 của roadmap. Ưu tiên tiếp theo phải chốt policy JWT/legacy-session/password revocation, rồi thiết kế scope snapshot/cache version và invalidation nhiều instance; dùng fixture nhiều process, không thử trực tiếp trên dữ liệu thật.

## Kiểm chứng và bằng chứng

Regression permanent: `tests/unit/kpi-cache.test.ts`, `tests/unit/cache-tags.test.ts`, `tests/integration/cache-invalidation.test.ts`. Fixture dùng Prisma/libSQL và các migration có sẵn, chỉ tạo dữ liệu giả ở `.local/performance/batch5-*`. Theo dõi kết quả full suite/build/browser và tích hợp tại mục 21 `tiendokpi.md`; evidence riêng tư `.local/performance/batch5/`.

Checkpoint local: **56 file / 572 test + 22 policy test đạt**, TypeScript và build đạt, lint app 0 error / 3 warning cũ, 0 broad tracing warning. 33 API status/body hashes trước/sau khớp; 6 calculator + 4 summary Chrome cases desktop/mobile không JS error, calculator giữ 1 report request. SQLite giả không đổi qua build/GET/browser. Đây là regression lab, không phải bằng chứng cloud latency hay permission revocation.
