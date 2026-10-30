# Cước CĐ: cache ngày báo cáo mới nhất

29/10/2026 — lát cắt local của Task 10, nối tiếp mục 40. Không đổi UI, không bật lại Tồn CDT/Rời mạng và chưa publish.

## Vấn đề và thay đổi

`GET /api/cuoc-cd/report` không chỉ định ngày luôn đọc `SELECT DISTINCT reportDate ... ORDER BY ... LIMIT 1` trước khi kiểm tra response cache. Vì vậy ngay cả khi response đã có, request vẫn gửi một report SELECT để tìm lại ngày.

Bản sửa chỉ thêm cache chuỗi ngày tại `cuoc-cd:report:latest-date`, TTL **30 giây từ read thành công**, dùng `cached !== null` để cache cả kết quả rỗng. Chỉ lookup sau auth, role, readiness và scope như trước; request chỉ định ngày không đụng metadata.

- Response cache vẫn dùng role/username/ngày/allowed-list hiện có, TTL60giây. Không chia sẻ rows giữa role.
- Generation capture vẫn là statement đầu GET, trước await auth. Metadata và response đều dùng token đó để ngăn fill cũ sau invalidation.
- Import và cấu hình đang gọi `clearCacheByPrefix("cuoc-cd:report")`, prefix này phủ cả key mới. Không sửa hai writer đó. Các lần clear toàn cache cũng phủ metadata.
- Ngày mới nhất vẫn là **ngày global** như SQL cũ, không đổi sang latest theo role. Lọc registered users, role/secondary/manager, thứ tự ID, rounding/summary và fallback schema cũ giữ nguyên implementation.
- AST đối chiếu xác nhận toàn bộ **5 SQL expressions và params không đổi** (latest, rows, config, users và users fallback). Không schema/index, SQL scope pushdown, seed, timer, dependency hoặc frontend request mới.

## Số lượt đọc đã đối soát

SQL của route thật chạy trên SQLite `:memory:` qua Node builtin. Auth/scope/readiness/Prisma là boundary giả; số dưới đây không bao gồm reads riêng của các helper này hoặc network/Turso latency.

| Trạng thái, schema User thông thường | Trước | Sau |
| --- | ---: | ---: |
| Latest request cold, có dữ liệu | 4 | 4 |
| Response và metadata đều còn cache | 1 | 0 |
| Khác role, response miss nhưng metadata warm | 4 | 3 |
| Explicit date, response miss | 3 | 3 |
| Empty latest, request lặp trong TTL | 1 | 0 |

Đây là số report SELECT thực thi trong database bộ nhớ, không phải số SQL toàn API, p95, throughput hoặc cam kết tăng tốc mọi request. Cache hết TTL/bị LRU evict có thể cần query lại. Legacy schema thiếu `secondaryCode` vẫn có read fallback thêm một lượt như trước.

## Regression và độ đúng

`tests/unit/cuoc-cd-latest-date.test.ts`: **RED18 semantic failure/3 pass → GREEN21/21** trên cùng fixture. Payload cũ và mới đều đối chiếu reference JS độc lập; failure RED ở cache/read-count hoặc freshness contract mới, không phải SQL/setup error.

Bao phủ ba role, case/whitespace/secondary/manager filtering, row order, decimal/zero/negative-zero/summary, explicit date, positive/negative TTL boundary và completion, scope-key thay đổi, auth401/403 khi metadata đã có, error/retry, legacy schema, invalidation trong auth và latest read đang chờ. Database được đóng sau mỗi test; không libsql hoặc DB file thật.

Tests mô phỏng prefix invalidation bằng cache API thật. Việc route import/config gọi đúng prefix có bằng chứng source; **không phải import/config write E2E**. Broader QA tại từng root và kết quả cuối ghi ở mục 41 `tiendokpi.md`/evidence, không dùng worker hoặc focused PASS thay primary.

**QA cuối:** WT V2 và primary chạy riêng, mỗi nơi **38 file/628 scoped test +22 policy đạt**, TypeScript nonincremental đạt, lint0error/3warning có sẵn. WT V1 có lint error vì helper test tên `useRole` bị nhận nhầm là hook trong loop; giữ log/hash, chỉ đổi identifier thành `setSessionRole`, không nới assertion/config hoặc sửa app sau freeze. Review APPROVE final pair:

| File | SHA-256 |
| --- | --- |
| `src/app/api/cuoc-cd/report/route.ts` | `5777aaa7197dbddbb0d7dfc211bfea7f465d284b3e44d50aaa8e523ec16e3701` |
| `tests/unit/cuoc-cd-latest-date.test.ts` | `5013cad832452b736cc3db6a648146a668e2c73afd08a4cdcdf70437868b0816` |

## Freshness và giới hạn

1. **Freshness contract mới:** cache đã fill giữ giá trị cho tới hết TTL30giây từ completion. Test positive/negative cache thực hiện write trực tiếp sau fill: ngày mới/report đầu tiên có thể chờ phần TTL còn lại nếu không gọi invalidator. Nếu write xen giữa read đang chờ, thời gian read và TTL có thể cộng lại; không có hard freshness bound cho mọi concurrent write hoặc nhiều instance. Import/config gọi prefix sẽ xóa trong cùng cache-store/module instance nhận invalidation, không claim identical behavior cho mọi uninvalidated write.
2. Không single-flight hoặc cache phân tán: concurrent cold misses có thể query lặp, nhiều Vercel instances không đồng bộ invalidation. Không snapshot transaction/linearizability/cancel response cũ. Caller cũ có thể nhận dữ liệu đã đọc, chỉ publication cache bị fence.
3. Không thay đổi những hạn chế của role/secondary matching cũ hoặc registry User fallback; không dùng đây làm chứng nhận đúng mọi quy tắc phân quyền. SQL scope pushdown, identity mapping/EXISTS và row-transfer optimization của Task10 vẫn pending.
4. Không fresh build/browser/RUM/database-online benchmark trong checkpoint này. Build trước không phải candidate mới; không nghiệm thu release, full-native Windows, timeout KPI cũ, strictvisual hay Node0TB timing uncertainty.
5. Không dependency audit mạng/upgrade trong lát cắt này; ba lint warning cũ không thuộc phạm vi. Không commit/push/deploy.

Evidence private `.local/performance/cuoc-cd-latest-date-20261029/` giữ snapshot/preimage, RED/GREEN, SQL invariants, frozen hashes, review/QA, backups/scans và integration manifests. Không commit log/env/DB/token/business data.
