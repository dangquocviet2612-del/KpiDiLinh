# GET users auth timeout: chẩn đoán import và CPU

Mục69, ngày30/10/2026. **Chỉ chẩn đoán local; không sửa application/public tests/config/dependencies, không auth/DB thật, commit/push/deploy hoặc tích hợp candidate68.** Lỗi gốc68vẫn pending, không dùng kết quả mới đổi failed gate thành pass.

## Kết luận ngắn

- Đã chạy đúng hai lượt đã định trước, cùng65file/1.276case. Cả hai không tái hiện timeout, vì vậy **chưa xác minh nguyên nhân 5giây và chưa có auth fix**.
- Test GETusers401 chờ dynamic import rồi mới gọi handler. Tracer cho thấy import/evaluation có chi phí trong lượt bình thường, nhưng không chứng minh chúng gây lần timeout trước hoặc endpoint Production chậm.
- Primary application vẫn mục67, source/test candidate68chỉ ở worktree. Giữ raw failed68log/hash và scopedAcceptance:false; không skip, tăng timeout, đổi pool, bỏ import khỏi budget hoặc chạy lặp tới xanh.

## Phạm vi và bảo toàn

Snapshot529publicpaths/378source-config-test,47primarydirty/282WTdirty và2.186oldartifacts. Hai source deltas từ68 (component+test) được giữ chính xác giữa main/worktree, không ép chúng bằng nhau hoặc promote source. HEAD/index/oldBUILD_ID giữ nguyên; chỉ bốn tài liệu public ở69. Mọi previous artifacts/failures/publication tiếp tục được kiểm hash.

Node24.13.1, Vitest5.0.1, Vite8.3.0 đang cài; không tải/cài/nâng thư viện. ENV giả in-memory và env-file guard cũ; không đọc token/credentials/dữ liệu kinh doanh. Selection lấy nguyên từ68, không thêm focused run/warmup hoặc full native/Next/browser suite.

## Hai lượt cố định

| Lượt | Worker observer | Kết quả riêng | GETusers401 |
| --- | --- | --- | ---: |
| A-coordinator | Không private setup/profiler/reporter/plugin; chỉ đọc metadata sau chạy |65/65file,1.276/1.276case pass |342,68ms |
| B-loader-cpu | Đúng một private setup; evaluator trace và inspector CPU chỉ trong schema-auth-order worker |65/65file,1.276/1.276case pass |320,54ms |

Original setup đúng1lần ởA; Bđúng original1+private1, không lặp UI setup. Timeout5000ms, forks/isolate và retry0 nguyên; preflight và runtime đều xác nhận. MaxWorkers không được xuất ở per-project config; không suy số worker hiệu lực. Mỗi lượt chỉ một quan sát, khác observer/thứ tự/cache, **không phải p95/đo độ ổn định/so sánh nhanh hơn hoặc nghiệm thu68**. Không cộng hai lượt thành2.552test riêng biệt.

### Lỗi preflight harness được giữ riêng

V1config-only child ghi `A-coordinator/config.json`, parent dùng trùng tên cho process report và bị EEXIST. Không test nào chạy ởV1. Child exit chưa được ghi, không bịa exit0 từ việc có config JSON. Giữ helper copies, preregistration/config/output và manifestV1. V2chỉ tách namespace/tên output và setup-v2; hai config preflightV2exit0, sau đó đúngA/Bmỗi lượt1lần. Không ghi đè label hoặc lỗiV1.

## Bằng chứng import/CPU ở lượt B

Worker16928,6evaluator spans, ownership/parent theo async context, không sửa thân test. Hai wrapper đã được restore và inspector disconnect; không truncate/sampler error. Các span inclusive dưới đây **không cộng với nhau**, vì schema chứa zod và tất cả nằm trong root:

| Span | Wall ms xấp xỉ |
| --- | ---: |
| users route evaluator |227,37 |
| next/server external |56,17 |
| api-auth evaluator |0,90 |
| user.schema evaluator |119,18 |
| zod external |107,51 |
| cache-tags evaluator |0,91 |

Root evaluator bắt đầu khoảng82,91ms sau beforeEach marker. Nó không bao gồm toàn bộ fetch/resolve trước khi evaluator được gọi; không lấy case duration trừ root rồi gọi phần còn lại là RPC/auth/handler. Cleanup không còn span pending; đây chỉ là lượt pass.

Profiler có555samples trên khoảng992,95ms, JSON270.063byte; khoảng bất định khi bật inspector là **74,61ms**. Với cả bracket được giữ,148samples chắc chắn và229samples có thể nằm trong cửa sổ beforeEach→afterEach. Đây là sample counts, không đổi thành milliseconds/phần trăm hoặc gán chính xác cho handler. Top leaf groups gồm idle, ESM compilation, internal loader/Undici và đọc/stat module; grouping theo function name+URL, không chứng minh nguyên nhân timeout hoặc dịch vụ nào chậm.

Cửa sổ hook khoảng318,42ms: processCPU user266ms/system47ms; event-loop idle60,88ms/active257,53ms. CPU là process-wide có background work, ELU không phải CPUtime; các giá trị không cộng với nhau và không phải exclusive import/handler metrics. Không kết luận scheduling/antivirus/GC/native/database từ những số này.

Coordinator còn lưu các URL fetch RPC durations có sẵn, được nhóm theo URL chứ không lưu danh tính case. Trong mỗi lượt, bốn URL được đối chiếu đều có một observation; không tự gán observation đó cho targetcase. Không dùng chúng thay thời gian import end-to-end hoặc cộng với evaluator spans.

## Đính chính nhãn collection

Installed `startVitest` tự `await ctx.close()` trước khi trả về ở run mode. Raw runner label “after startVitest returns, before close” chỉ là trước lần close bổ sung của runner, **không phải trước auto-close**. Đã kiểm source installed `cli-api.DcLieX4F.js`, ghi erratum trong review/summary; giữ raw label/helpers để không viết lại evidence. Việc đọc metadata là hậu kiểm sau auto-close. Các labels tương tự của runner58cũng không nên được diễn giải là live pre-close trace; không sửa số liệu/log lịch sử.

## Review và bước tiếp theo

**Review độc lập APPROVE_DIAGNOSTICS_CONCLUSIONS_ONLY đúng hash summarizer và summary; không P1/P2 về số liệu/kết luận.** HarnessV2đã được review APPROVE_DIAGNOSTICS_ONLY đúng4helper hashes trước test; cả hai review không app-fix hoặc acceptance approval. Draft docs không nằm trong phạm vi reviewer, được đối chiếu số liệu và scan/default redacted, kiểm whitespace/preimages/backups/hash-inventory trước tích hợp docs-only.

Không có failing trace mới nên không sửa auth theo suy đoán. Lượt QA có ý nghĩa tiếp theo nên thu metadata ngay trong chính lần lỗi phát sinh, không chạy lặp diagnostic sau khi lỗi biến mất. Cần trace định vị được import/handler/wait của lượt fail rồi mới đặt regressionRED và minimalfix; dữ liệu CPU của lượt pass chưa đủ. Không tự bỏ strict gate hoặc promote68.

Evidence private `.local/performance/schema-auth-cpu-trace-20261030/`: snapshot, V1preservation, preregisteredV2plan/helper hashes, config/process/state/log từngcell, Bworker/evaluator/CPUprofile, summary/reviews và docs-only integration/pending manifests. Không commit profile/log/env/DB/credentials. Native Windows/libSQL/KPI-timeout, Node0TB strictvisual/timing, fullNext/browser/ba role, Task12/CI-RUM/release vẫn mở.
