# Node0TB: tái sử dụng kết quả khớp tiền tố trong một request

> Task9, local 29/10/2026. Không thay giao diện, SQL, phân quyền hoặc quy tắc chọn tọa độ. Chưa commit/push/deploy; nghiệm thu native/strictvisual/release vẫn riêng.

## Vấn đề và lựa chọn

`getNode0TbList` hiện đọc Node0Tb và Node, tạo nodeMap rồi khớp từng dòng: exact mã đầy đủ → exact mã gốc → phần tử đầu tiên khớp tiền tố theo hai chiều. Nếu nhiều dòng `-SP1`, `-SP2`… cùng mã gốc đều cần fallback, vòng lặp quét cùng danh sách node nhiều lần, kể cả khi không tìm thấy.

Chọn memo nhỏ **chỉ trong từng lần gọi service**, không trie, không cache dữ liệu giữa người dùng/request. Tối đa1.000 mã gốc fallback được lưu; khi đầy, mã chưa lưu vẫn chạy phép quét cũ, không bỏ dữ liệu/evict. Đây không phải giải pháp loại bỏ worst-case quét theo mọi mã gốc khác nhau.

## Hợp đồng implementation

- Chỉ `src/lib/node-0tb-db.ts`: khai báo local `prefixMatchCache` sau nodeMap và bọc nhánh prefix fallback. Không thêm helper/export/dependency/async hoặc sửa query/readiness.
- Từng dòng vẫn kiểm exact code, rồi exact base **trước** memo. Prefix giữ phần tử khớp đầu tiên trong thứ tự Map, không chuyển sang longest-prefix/sort.
- Dùng `.has(baseCode)` trước `.get(baseCode)`: `undefined` đã lưu là một kết quả “không tìm thấy”, không phải chưa tính. Nhờ đó các sibling thiếu tọa độ cũng tránh quét lặp.
- Key là `baseCode` đã được logic cũ tính; giữ nguyên strip SP trước trim, upper-case, blank/Unicode và normalized-name collision. Không sửa chính sách prefix mơ hồ hoặc validation tọa độ.
- Mỗi lần gọi tạo memo mới, kể cả gọi lại sau khi node đổi tọa độ/description hoặc khi request chạy đồng thời. Không TTL, invalidation, shared cache hay cache quyền mới.
- Giữ mọi field/order/date fallback, stats/categories toàn tập trước filter, search theo description, category, legacy/map projection. NodeMap/Node0TbMap UI/customer services/auth/DELETE/upload/template không đổi.

## Phép đo

Chạy service và import-utils thật với Prisma/readiness boundary giả. Các dataset trước/sau phải dùng cùng input, so full-response hash, query/readiness counts và input không mutate.

| Profile | Dòng | Node đầu vào | Quét trước | Sau |
| --- | ---: | ---: | ---: | ---: |
| Grouped fallback | 138 | 1.000 | 138 | 20 |
| Grouped fallback | 1.000 | 1.000 | 1.000 | 100 |
| Grouped fallback | 10.000 | 1.000 | 10.000 | 100 |
| Grouped fallback | 50.000 | 1.000 | 50.000 | 100 |

Grouped138 có20mã gốc, các grouped khác100mã gốc; xen kẽ positive/missing fallback.50k duyệt49.387.500→98.775cặp. Full-response hashes khớp ở12datasets, giữ input/cùng2backendreads+1readiness call. Exact-only0scans, distinct-miss vẫn1scan/dòng, không gán lợi ích grouped cho mọi workload.

Timing chỉ là diagnostic local CPU/service qua mocked DB, có warm-up và3mẫu, không gồm JSON serialization. Counter instrumentation chạy lượt riêng, không gộp vào elapsed timing. Không cloud/API/database/page-load/p95/50k-marker-render measurement; không suy ra production có cùng phân bố mã gốc.

### Timing chưa được nghiệm thu

| Diagnostic50k | Grouped trước → sau (ms) | Unique-miss trước → sau (ms) |
| --- | ---: | ---: |
| Matrix đầu, median3mẫu, process riêng | 647,665 → 17,925 | 614,184 → 1.526,097 |
| Paired cùng process, median5mẫu/version | 426,992 → 13,035 | 417,133 → 423,051 |

Matrix đầu có unique-miss chậm khoảng2,5lần dù cùng50triệu visited pairs. Đã giữ nguyên toàn bộ số liệu/source, không sửa app hoặc ghi đè kết quả. Một diagnostic kiểm soát dùng hai source hash thật trong cùng process, alternating order,2warmups+5mẫu/version, không Map-prototype instrumentation/GC flags/forcedGC, trả cùng JSON. Lượt này không tái hiện mức chậm lớn, **không chứng minh nguyên nhân matrix đầu hoặc mọi unique request không bị regression**. Không quy kết GC/JIT/máy bận là nguyên nhân đã xác minh, không gọi là flake/vô hại.

Quality Lorentz **APPROVE_LOCAL_FUNCTIONAL_ONLY** đúng2frozenhashes, giữ unique timing uncertainty/performance acceptance/release mở. Không chuyển timing diagnostic thành lời hứa tăng tốc toàn web hoặc coi đây là miễn gate. Parent build/browser/integration/primary vẫn là điều kiện riêng.

### Điều tra observer history, mục36

Tám fresh sequential processes,2source×2history×2repetition, giữ12workloads và số call, chỉ thay observer ở lượt thứ năm. Unique50k G history có timing cao hơn U ở cả hai sources/repetitions, dù observer không trực tiếp nằm trong timer. Nhưng source-ratio interaction là1,086 rồi0,967: chưa giải thích after/before anomaly2,5× cũ hoặc xác minh cơ chế JIT/GC. Giữ toàn bộ số liệu cũ và flags OPEN, không sửa app. Các secondary unique138/exact-only cũng có median sau cao hơn ở một số hoặc cả bốn so sánh; không claim mọi request nhanh hơn. Chi tiết đủ samples/contrasts/12workloads tại `docs/node0tb-timing-investigation.md`; đây chỉ là checkpoint diagnostic/tài liệu, không performance acceptance.

## Kiểm thử / runtime gates

Semantic RED **33fail/6pass→GREEN39/39**, real service/import-utils+legacy oracle và narrow actual Map iteration observer, không mock kết quả matching. Cover warm exact-code, exact-base precedence riêng, positive/missing/empty map/key, collision/Unicode/raw SP whitespace, zero/null, cap/reset/concurrent-call isolation, fields/stats/filters/readonly/errors.70test cũ/22UI giữ nguyên. Parent fresh **34file/557scoped+22policy/full types/lint0error/2warning cũ/build/static login**,2frozenhashes/fakeDB unchanged. Spec review APPROVE source/API only; quality/runtime/primary gates cập nhật ở mục35.

Private fixture riêng có20Node0Tb/14tọa độ/6thiếu; thêm4sibling SP vào bản sao fake cũ, có positive/missing memo hit mà không đọc dữ liệu thật. Browser ba role×390/1440×light/dark; actual API legacy/map/search/category/unknown projection, repeat reads, anonymous401. UI count/filter/list/missing/search/popup/GPS/error-retry/admin visibility phải giữ, không business write. Provider images giả/SW off/GPS/error inject; summaries không phải full DOM/pixel equivalence.

### UI capture v1 và recapture đối xứng

V1 đã fail strict UI-summary equality:24API cases và toàn bộ payload hashes khớp,67/72summaries khớp,5desktopGPS-denied states thiếu bốn tooltip text. Giữ runner exit1/assertions/error/partial/ảnh/build metadata nguyên tại `capture-v1`; không tạo file PASS từ partial hoặc bỏ text khỏi so sánh.

Control cùng candidate build/fixture,2fast+2settled runs: với chuỗi thao tác cũ, bốn nhãn hiện ởGPS+350ms rồi mất ở+800/+1600ms dù không có thao tác mới; khi chờ1600ms sau popup/mỗi zoom/fit thì trạng thái ổn định từGPS+0 đến1600ms. CSS zoom class=false trong mọi probe, nên không kết luận lệnh zoom bị Leaflet bỏ qua. Evidence chỉ ra snapshot350ms chưa quiescent, CSS flag/networkidle không đủ. Source hiện có flyTo1,2giây/0,9giây và timer50ms.

V2 giữ nguyên toàn bộ assertion/APIcases/72summary comparison. Chờ1600ms bao phủ thời gian fly đã khai báo, rồi yêu cầu transform/marker/tooltip signature ổn định200ms và không CSS zoom/pan (timeout5giây); tách zoomIn/out/fit bằng cùng wait. Áp dụng **giống nhau cả baseline và candidate**: tạm phục hồi đúng service preimage trong WT, rebuild/capture baseline, sau đó phục hồi exact2candidate hashes, QA/build/capture lại. Test mới giữ nguyên, chỉ hiện diện type-check/non-runtime trong baseline build. Primary không đổi trong thí nghiệm này. Capture reviewer Bernoulli APPROVEprotocol/evidence preservation, không thay runtime result.

**Controlled v2 đạt:**24APIcase status/body/bytes/count/repeat hashes khớp;12browsercase/72full summaries text/buttons/disabled/links/overflow khớp, cùng một initial request và lỗi500→retry200. Bootstrap20rows/14coordinates/6missing, projected/legacy/search/category/unknown modes, sibling positive/missing mappings và admin-only UI/anonymous401 giữ đúng.0business writes/JS/unexpectednetworkerrors, fakeDB/hash unchanged. Sau restore đã kiểm lại557scoped+22policy/types/lint/build; app source hai hash giữ nguyên. Gate primary/integration ở mục35 tiến độ.

Không sửa frontend, tắt animation hoặc nới/strip assertion. Đây không phải chứng minh mọi rapid-click workflow, không giải thích/đóng strictvisual3PNG/2geometry của checkpoint cũ trên fixture16rows.

## Giới hạn / việc còn mở

- Exact/base-only workload vốn không quét prefix nên không có lượt quét để giảm. Unique-base workload và các key mới sau cap vẫn quét như cũ; memo thêm tối đa1.000entry local, không hứa mọi request nhanh hơn.
- Số SQL/readiness và payload không giảm; hai reads vẫn tồn tại. Hai lần đọc chưa thành snapshot transaction, không thêm concurrent-write consistency guarantee.
- Giữ nguyên first-prefix phụ thuộc thứ tự node DB trả về; không chứng nhận đây là match nghiệp vụ tối ưu hoặc thứ tự DB luôn ổn định. Có ambiguity cần business decision riêng.
- Native Windows full-suite801/815 rồi worker3221225477 chưa sửa, không full-native retry/skip/pool/upgrade.2lint warnings cũ ở upload Node0TB/node giữ nguyên.
- Strictvisual Node0TB trước còn3PNG/2geometry khác chưa rõ nguyên nhân. Fixture/functional comparison mới không miễn hoặc đóng gate ảnh cũ; không đổi assertion/source/log thất bại trước.
- Customer marker/detail DTO, node thường/full-detail loading, Node0TB unique-prefix index, viewport/clustering và toàn Task9 còn pending. JWT/revocation/đa instance/single-flight, `/api/me`500 cũ, điện thoại/provider/PWA thật và release chưa nghiệm thu.

## Evidence và rollback

Plan `docs/superpowers/plans/2026-10-29-node0tb-prefix-memo-local.md`, tiến độ mục35. Evidence private `.local/performance/node0tb-prefix-memo-20261029/`: snapshot/preimage, RED/GREEN/source hashes/diff/reviews, benchmark before/after, QA/build/API/browser/integration manifests. Không commit SQLite/env/log/cookie/credentials/business bodies.

Rollback chỉ declaration/memo branch và tài liệu slice sau kiểm preimage/hash, không reset85thay đổi trước hoặc overwrite file đã được chỉnh tiếp. Schema/API/data không thay, không cần migration/restore dữ liệu.
