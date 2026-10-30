# Customer → node: bulk lookup read batches

> Task9 continuation, local 29/10/2026. Không đổi UI, SQL nghiệp vụ, auth/cache, database thật, dependency hoặc release. Kết quả chỉ được chốt sau các gate thực tế tại mục34 của `tiendokpi.md`.

## Phạm vi nhỏ nhất

`src/lib/customer-node-mapping.ts`, hàm `getMappedNodeNamesByAccounts`: chỉ đổi `chunkSize` **300 → 900**. Vẫn chuẩn hóa account bằng `toTrimmedString(...).toLowerCase()`, loại blank/dedupe bằng Set, await readiness một lần, SELECT tuần tự với một anonymous binding cho mỗi key, lấy cùng cặp accountKey/nodeName vào Map. Không parallel/cache/join/JSON extension hoặc thêm transaction.

SQL có tối đa900bindings và không có predicate binding khác. SQLite công bố historical default999 và newer default32766; giới hạn có thể bị hạ bởi build/runtime, nên đây không phải chứng nhận database online. [SQLite host-parameter limits](https://www.sqlite.org/limits.html#max_variable_number).

Các chunk300 của existing-mapping lookup cho upsert, write180, sync350 và single-account lookup giữ nguyên byte. Mechanical reversal của đúng literal phải tái tạo toàn bộ preimage; không refactor/export/constant hoặc thay assertion cũ.

## Consumer / semantics

| Luồng | Entry point | Hành vi giữ nguyên |
| --- | --- | --- |
| Bản đồ khách hàng | `/api/customers/map-data`, `includeDetails=true` | Query customer theo scope/take/coordinate filter trước; mapping truthy ghi đè nodeName, thiếu/empty giữ fallback. Customer array/order/meta không đổi. Details-off không lookup. |
| Danh sách khách hàng | `/api/customers` | Scope, pagination/order/cache; mapping theo normalized key. Limit hiện tối đa100 nên mỗi trang thông thường vẫn một mapping SELECT, không claim trang list tăng tốc vì batch này. |
| Import khách hàng | `/api/import` | Explicit Node → mapped account → nearest fallback giữ nguyên; file row order/write flow không đổi. Không chạy import nghiệp vụ hoặc xác nhận end-to-end import trong slice này. |

`search-map` không gọi helper này. Ba consumer thực tế chỉ dùng `.get(key)`, không iterate/serialize Map. SELECT không có ORDER BY; ghép batch có thể đổi insertion order của Map, không hứa Map iteration identity. So sánh key/value và customer DTO/order thay vì ép một SQL order chưa tồn tại.

## Baseline và phép đo

Thực thi chính helper/normalization trước/sau, DB boundary giả, đối chiếu13boundarysizes:

| Unique accounts | Mapping SELECT trước | Sau | Giảm lượt đọc |
| ---: | ---: | ---: | ---: |
| 1.000 | 4 | 2 | 50% |
| 10.000 | 34 | 12 | 64,71% |
| 50.000 | 167 | 56 | 66,47% |

Mapping key/value hashes bằng nhau, normalized keys không mất/lặp, input không mutate, query vẫn parameterized, tối đa900bindings. Không phải tổng API SQL hoặc latency benchmark.

Fixture riêng sao chép từ SQLite tổng hợp đã có hash:1812customers,1544mappings, chỉ10customer có tọa độ.1802customer thiếu tọa độ giúp API `hasCoordinates=false&includeDetails=true` đi qua900bindings mà không thêm marker vào browser. Fake account có trim/case/quoted text, có mapped/fallback cases; không dùng khách hàng thật.

Semantic RED12fail/36pass→GREEN48/48,20helper+28real-route/cache cases.69test cũ/22UI file giữ nguyên. Initial sandbox EPERM của runner được lưu riêng, không tính là semantic RED; không sửa app/config/native để né. Production chỉ thay một byte, reversal khôi phục toàn preimage.

Parent candidate đạt **33file/518scoped test+22policy**, full TypeScript/build, login static; lint0error/2warning cũ (`skippedRows` ở uploadNode0TB, `readSheetObjectRows` ở uploadnode). Owned lint không thay thế full-source lint. Frozen2source hashes và fakeDB giữ nguyên. Spec Archimedes rồi quality Hume độc lập đều APPROVE source/API local, không sửa source; primary/integration gates ghi riêng ở mục34.

**API/browser trước-sau:**21scopedAPI cases =3roles×7requests, mỗi case first+warm replay, status/body/bytes/count hashes khớp. Bao gồm details on/off, coordinate filter, take900/901/1800/20000 và customer list; anonymous401. Large map-data details-on trả1812ADMIN/1812MANAGER/906CTVrows, account mapping truthy override/missing fallback đúng. Request đầu trên candidate process dùng helper đã build900 và >900distinct keys: **actual local Prisma/SQLite900binding reads đạt**, không chỉ standalone SQLite/mock proof.

12browsercase =3roles×390/1440px×light/dark,48UI summaries/nearest confirmation/polyline khớp; node/customer/scoped-view payloads giữ nguyên. GPS-denied/customer500/retry đúng,0business writes/JS/unexpectednetworkerrors, database/hash unchanged. Không phải full DOM/pixel identity, field performance, production write hoặc remote database acceptance.

## QA / giới hạn

- Tests mới chạy helper/import-utils/map-data route/cache/core thật, mock auth/Prisma/readiness/scope/nearest boundaries. Cover ranh giới batch, normalize/dedupe/purity/parameters, tuần tự/errors/no writes, mapping override/fallback, role/cache/generation.
- Native-free scoped selection không phải full suite. Không chạy lại/skip/retry/pool/upgrade để che native Windows801/815 crash trước; giữ2warning lint cũ.
- Số query đo chỉ là SELECT trong bulk mapping helper, không gồm readiness/auth/scope/customer reads hoặc tổng SQL của API; không đo cloud latency/p95, total-page time, payload reduction hay throughput.
- Không tăng tốc batch≤300 nhờ giảm số query, không thêm viewport/clustering/customer DTO hoặc sửa Node0TB prefix matching. Prefix index được hoãn để tránh thêm cấu trúc trước khi có CPU/workload evidence.
- Các batch vẫn là nhiều SELECT không transaction; không bảo đảm snapshot khi concurrent writes. Shared-cache/JWT/revocation/nhiều instance/single-flight và nguyên nhân `/api/me`500 cũ chưa xử lý.
- Browser dùng API thật trên DB giả, provider images tổng hợp/SW off/GPS/error inject; UI summaries không phải full DOM/pixel equivalence hoặc điện thoại/provider/PWA thật. Strictvisual Node0TB3PNG/2geometry còn mở.
- Import còn query customer account list riêng, không được bảo đảm parameter budget bởi thay đổi helper này. Không sửa write batching, transaction/audit hoặc import-file job.
- 900bindings trên local SQLite/Prisma không chứng nhận custom/remote Turso/Vercel config. Chỉ deploy khi owner duyệt và staging/production gate riêng đạt.
- Task9/native/visual/release chưa hoàn tất; chưa commit/push/deploy. Release đã xác minh gần nhất vẫn9d0365e.

## Evidence / rollback

Plan `docs/superpowers/plans/2026-10-29-customer-node-mapping-batches-local.md`, tiến độ mục34. Evidence private `.local/performance/customer-mapping-batches-20261029/`: snapshot/preimage/frozen hashes/diff, RED/GREEN, benchmark trước/sau, scoped logs, build/API/browser và integration manifest. Không commit SQLite/env/log/cookie/credentials/business bodies.

Rollback đúng literal về300 sau so preimage/hash; không reset toàn checkout hoặc các81thay đổi trước. SQL/schema/API/consumer không thay nên không cần migration/data rollback. Preimages tài liệu và service giữ riêng để hoàn nguyên có chủ đích nếu chưa bị chỉnh tiếp.
