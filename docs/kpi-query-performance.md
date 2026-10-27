# KPI query performance — local batch 4

Ngày: **27/10/2026**. Phần đầu Task 6 trong roadmap UX/performance. Đây là source local sau batch 3, không phải release Production đã deploy. Không đọc env/database phục hồi, không kết nối Turso hoặc thay đổi dữ liệu thật trong batch này.

## Thay đổi

| Luồng | Trước | Local batch 4 |
|---|---|---|
| KPI cá nhân, cache miss | Chờ query rows rồi mới đọc config/cước | Rows, target và cước chạy trong cùng `Promise.all`, sau auth/scope/date/cache gate |
| Tổng hợp KPI thông thường | Query danh sách nhóm rồi query lại metadata nhóm được chọn | Một query metadata; dedupe raw group trước trim, lọc nhóm được chọn trong bộ metadata đã đọc |
| Tổng hợp cước | Chờ target rồi mới đọc cước cùng ngày | Target và cước cùng ngày chạy song song; giữ fallback date theo toàn scope |
| Data SQL | JOIN/GROUP BY có filter CTV | Giữ JOIN/GROUP BY và tham số bound; dùng chung templates với EXPLAIN |

Các file chính: `src/app/api/kpi/report/route.ts`, `src/app/api/kpi/summary/route.ts`, `src/lib/kpi-report-queries.ts`. Không thay `prepaid-query.ts`, scope/cache helpers, công thức, ngày fallback, rounding, max-percent, isNegative, auth, TTL hoặc schema/migration.

Query metadata mới sắp xếp bằng SQL theo `COALESCE(sortOrder, 0), name`. Lấy lần xuất hiện đầu tiên của mỗi **raw group** giữ thứ tự theo minimum sort-order như GROUP BY cũ. Chỉ trim sau dedupe, nên hai raw group khác nhau nhưng cùng tên sau trim vẫn xuất hiện hai lần như trước. Không đổi thành sort JavaScript hoặc dedupe sau trim. Việc khớp selected group vẫn so với raw name, giữ cả hành vi với whitespace/case/Unicode.

## Bằng chứng tương đương và query count

`tests/integration/kpi-report-equivalence.test.ts` dùng PrismaLibSql thật và SQLite giả do test tạo/migrate; chỉ mock auth, bọc Prisma để quan sát logical reads và từ chối writes. `tests/fixtures/performance/kpi-report-golden.json` chứa 63 status/full-JSON hashes chụp một lần từ **source local trước batch 4**, cùng hash hai handler gốc; routine tests không tự cập nhật golden. 60 case kết hợp golden với assertion cụ thể về công thức, scope và dữ liệu không đổi.

Coverage gồm ADMIN/MANAGER/CTV, đổi query CTV trái quyền, manager outsider/secondary-code, admin-all/filter-manager, metric dương/âm/disabled/merged/null/zero, cước mới nhất khác ngày KPI, fallback cước toàn scope, nhóm đầu/unknown/whitespace/case/Unicode/tie, scope rỗng, ngày rỗng và cold/warm cache.

| Quan sát trên cùng fixture, sau auth giả | Trước | Sau |
|---|---|---|
| ADMIN summary, explicit date, cold | 6 logical Prisma reads | 5 |
| MANAGER summary, explicit date, cold | 6 | 5 |
| Metadata reads trong hai case đó | 2 | 1 |
| Metadata rows được truyền về trong fixture | 15 | 15 |
| Warm cache của hai case đó | 0 logical reads | 0 |

Các số này gồm guard/scope khi cold, nhưng **không gồm chi phí auth thật**, không phải raw network packet count hoặc latency. Personal report chủ yếu giảm chuỗi chờ, không tuyên bố giảm số data reads. Query độc lập chạy đồng thời không đảm bảo libSQL backend thực thi đồng thời hay cloud nhanh hơn bao nhiêu phần trăm.

`tests/unit/kpi-query-scheduling.test.ts`: 3 case RED ở code cũ rồi 7/7 GREEN sau tối ưu. Chặn row/target promise để xác minh các nhánh độc lập bắt đầu; scope chưa resolve, thiếu date và anonymous không được prefetch dữ liệu thừa. Test timing cũ được cập nhật mock metadata gộp và vị trí tham số; không đổi expected math, payload, manager cache key hoặc TTL.

Chrome thật trên fixture riêng: 33 status/body hashes API trước/sau khớp; 6 calculator cases qua 3 role × desktop/mobile có 1 report request, không JS error. Tổng hợp KPI có smoke độc lập ADMIN/MANAGER × desktop/mobile, mở danh sách chỉ tiêu và chọn nhóm cước trả 200, không JS error. Schema/data fixture không đổi sau nhóm GET/browser; build cũng không đổi SHA-256 SQLite giả. Smoke không thay thế kiểm thử đổi filter nhanh, hủy request hoặc mọi navigation/permission revocation.

## EXPLAIN chỉ đọc trên local snapshot

Chạy bằng **Node 24**, chỉ trên file SQLite giả/snapshot được duyệt, đã tồn tại và không có concurrent writers:

```powershell
node scripts/performance/explain-reports.mjs --database "file:.local/performance/your-fixture.sqlite" --ctv "KPI_EXPLAIN_CTV" --report-date "2000-01-01" --group "KPI_EXPLAIN_GROUP"
```

Không có target mặc định, không tự đọc `.env`, không dùng `DATABASE_URL`; các tham số còn lại có synthetic defaults. Reject remote/UNC/network, file thiếu, thư mục, option trùng/lạ/thiếu value trước query. Không log URL, token, SQL params, business rows hoặc raw driver error. JSON chỉ chứa planner fields. Templates personal/metadata/aggregate dùng chung với route; latest-date probe là cùng access pattern CTV/date trong helper hiện có.

Công cụ dùng SQLite tích hợp Node mở `readOnly: true`, không tạo database nếu file biến mất giữa stat/open. Chỉ chuẩn bị và chạy `EXPLAIN QUERY PLAN SELECT`, đóng connection trong `finally`. Chế độ này không phải sandbox filesystem/backup nhất quán; vẫn phải dùng snapshot riêng, không benchmark database app đang ghi hoặc symlink/target chưa được duyệt. Planner của SQLite tích hợp Node không chứng minh plan/RTT của libSQL/Turso online giống hệt.

Fixtures EXPLAIN nhỏ/lớn có 12/1.984 dòng, thêm test trên fixture app đã áp dụng catalog 5 migration. Personal JOIN dùng UNIQUE `reportDate/ctvUser/kpiCode`; aggregate dùng index date/CTV đang có; latest-user date dùng covering index. Tên index thực tế khác nhau giữa fixture tối thiểu và app đầy đủ, nên không ép tên index cho mọi plan. Metadata vẫn SCAN/config-sort và personal có temporary ORDER BY B-tree; chưa có bằng chứng cần thêm index. Không tạo migration/index hoặc đổi region trong batch này.

## Giới hạn và phần tiếp theo

- Kiểm tra tại checkout tách riêng: **53 file / 504 test + 22 policy test**, TypeScript, scoped lint và build đạt. Lint app giữ 0 error / 3 warning cũ. EXPLAIN có 39 test, gồm read-only open thực tế và stat/open race không tạo file. Node 24 hiện phát `ExperimentalWarning: SQLite` cho công cụ local này; không tắt warning ở command hướng dẫn và không xem đây là warning build của app.
- Chưa benchmark auth/SQL trên Turso thật, cold Function, contention, multi-region, p50/p95 hoặc mạng di động. Không suy diễn SQLite lab thành cam kết tốc độ Production.
- Metadata đọc các field cần thiết của **toàn bộ enabled config** thay vì chỉ metadata nhóm đang chọn. Fixture hiện giữ cùng số dòng metadata, nhưng config có nhiều metric/nhóm có thể tăng lượng truyền về; cần đo dataset mục tiêu trước rollout.
- Không sửa scope cache/revocation hiện có. Task 7 vẫn cần invalidation matrix, đổi role/manager/CTV, restore và kiểm thử nhiều instance; TTL hiện tại không được coi là cơ chế thu hồi quyền ngay lập tức.
- Task 5 còn lifecycle request của summary/manager; Task 8–11 còn chia bundle, DTO/viewport bản đồ và UI responsive/accessibility. Không xem batch này là đã tối ưu toàn bộ web hoặc hoàn thành Task 6 end-to-end.
- Database phục hồi/online chưa được preflight contract hoặc verified adoption. Source không được tự cutover; không chạy migration để vượt guard. Xem `docs/runtime-schema.md`, `docs/migration-safety.md`.
- Chưa commit/push/deploy. Log/report riêng tư ở `.local/performance/batch4/`; không đưa credentials, session, env, SQLite hoặc response bodies vào Git.
