# Điều tra timeout GET users — checkpoint 57

## Kết luận

**Chưa xác định nguyên nhân và chưa sửa lỗi auth.** Hai lượt broad QA không gắn profiler của checkpoint56 vẫn thất bại: mỗi root primary/worktree **893 pass / 1 fail trên 894 test**; test `GET users returns 401 without schema or database access` timeout5000ms. Các lượt diagnostic dưới đây không tái hiện timeout, không thay thế hai gate đỏ này.

Đợt57 chỉ thêm/cập nhật4tài liệu public; không đổi application code, test/fixture public, dependencies hay project config. Chỉ kiểm tra local, không sử dụng phiên đăng nhập/database thật, commit/push/deploy hoặc build mới. Không claim cải thiện tốc độ web.

## Phạm vi và điều đã xác minh

- `D:/code/webkpimoi/tests/unit/schema-auth-order.test.ts:119`: `invoke` chờ dynamic import `route.load()` rồi mới lấy và gọi handler. Budget của test bao gồm cả bước import, không chỉ thời gian xử lý401. `beforeEach` tại dòng147 reset modules/mocks; nguyên trạng.
- `D:/code/webkpimoi/tests/unit/schema-auth-order.test.ts:177`: contract401 và không gọi schema/database/body reader vẫn được giữ; không skip/quarantine hay sửa assertions/mocks/resetModules để lấy xanh.
- `D:/code/webkpimoi/src/app/api/users/route.ts:20`: GET kiểm auth rồi trả401 khi thiếu session, trước `ensureManagerCodeColumn`. Các static imports bắt đầu tại dòng4; validation schema dùng cho POST vẫn được import ở cấp module. Đây là mô tả source, **không phải bằng chứng import đó gây timeout**.
- Cùng selection của56:51file/894test, gồm61case của schema-auth-order; chỉ chạy diagnostic trên worktree đang có, không tạo nhánh mới hay chạy full native suite. Selection này không phải toàn bộ test repository.
- Installed Node24.13.1/Vitest5.0.1/Vite8.3.0; giữ testTimeout5000ms, poolforks, isolatetrue. Không đổi dependencies hoặc cấu hình public.
- Synthetic process env và `envDir:false`/private env-file guard; guard chặn các đường dẫn đã biết, **không phải security sandbox tổng quát**. Không đọc credentials/DB thật để đo.

## Kết quả từng lượt — không cộng các lượt thành một bộ nghiệm thu

| Lượt | Kết quả riêng | Điều có thể kết luận |
| --- | --- | --- |
| QA56 primary và worktree, không profiler | Mỗi root893pass/1fail trên894; GETusers5000ms | Hai failed gate vẫn mở, giữ log/manifest gốc |
|57body trace, private in-memory transform |51file/894PASS;395events,53invocations,61hook triples | Lượt này không tái hiện; GETusers import385.29ms, handler7.81ms |
|57loader profilerV1 |325testpass;36suitefail/15suitepass | Cross-drive private setup `/@fs/C:/...` không resolve trong jsdom; workload không hợp lệ để so nguyên nhân |
|57loader profilerV2 |51file/894PASS | Config merge chạy original UI setup2lần; bị nhiễu, không exact-baseline comparison |
|57loader profilerV3 |51file/894PASS; targetcase315.56ms | Config và worker xác nhận originalsetup1+private1, không transform thân test; vẫn instrumented, chưa tái hiện timeout |

V1/V2 là lỗi/hạn chế harness, không gọi là application regression. Đã giữ raw artifacts và runner/setupV2; V3 chỉ sửa phần private setup append để không lặp originalsetup. Không thay test timeout/pool, mock/assertion hoặc app để đạt894PASS. Không suy diễn warm/cold cache, độ ổn định, p95 hay tốc độ production từ các lượt này.

### Chi tiết timing đủ điều kiện báo cáo

Body trace chèn trước/sau import và handler, giữ identity test/path/method/pid/worker/sequence qua await; snapshot module map chỉ đọc. Lượt đầu có10module, nhưng trường `totalTime` không tồn tại ở internal record (`duration` là trường khác), nên **không có số tổng từ snapshot đó**. Không chuyển trường thiếu thành0.

V3 buffer6span của đúng targetcase tới afterAll, không stdout ở hot path; có ownership/parent theo async context. Inclusive wall spans:

| Span | Wall time xấp xỉ |
| --- | ---: |
| users route evaluator, span cha |244.20ms |
| next/server, nằm trong route |51.22ms |
| api-auth, nằm trong route |0.87ms |
| user.schema, nằm trong route |131.97ms |
| zod, nằm trong user.schema |120.36ms |
| cache-tags, nằm trong route |0.67ms |

Không cộng các span lồng nhau.244.20ms không phải thời gian import end-to-end: wrapper evaluator không bao phủ mọi resolve/transform/RPC/scheduling. Phần chênh với315.56ms của test **chưa được quy thuộc**, không gọi là handler time.7.81ms là handler time của **lượt body trace khác**, không ghép hai lượt thành timeline chung. Zod/Next hiện trong một lượt pass không chứng minh chúng gây lỗi5000ms; chưa có failing trace để phân biệt import/handler/scheduling hay yếu tố khác.

## Giới hạn và review

- In-memory transform, logging và profiler đều có observer effect. V3 thêm private setup, private evaluator prototype wrappers, ALS/snapshots/continuations; không phải uninstrumented baseline dù thân test không đổi.
- CPU snapshots là cumulative process-wide, không riêng module/thread; ELU mô tả event-loop activity, không phải CPU hoặc độ trễ web thực tế.
- `pending:[]` chỉ là snapshot lúc cleanup; không chứng minh không thể phát sinh công việc muộn. Prototype restore/flush chỉ bảo đảm trên đường hoàn tất bình thường, không khi bị kill/crash.
- Internal Vitest evaluator/map API có thể thay đổi; tooling chỉ ở ignored/private paths, không thêm dependency hoặc đưa thành runtime ứng dụng.
- Independent static review APPROVE đúng5hash của tooling cuối cho **diagnostics và kết luận giới hạn**, không phê duyệt auth fix/acceptance/release. Review không chạy thêm test và không thay parent verification.
- Giữ3warning lint cũ theo QA56;57không chạy lại lint/types/build để làm bằng chứng auth đã được sửa.

## Evidence local và bảo toàn

Private evidence root: `D:/code/webkpimoi/.local/performance/schema-auth-timeout-repro-20261030/`. Không commit log, env, database, token hoặc dữ liệu khách hàng.

- `starting-files.json`:491union paths/360source-config-test paths/172dirty paths/1587old artifacts trước57.
- `broad-import-trace.log`, `.json`, `-state.json`: body trace395events và kết quả894PASS.
- `unchanged-body-loader-trace/`, `unchanged-body-loader-trace-v2/`, `profiler-v2-*`, `loader-resolved-config.json`: V1invalid/V2confounded giữ riêng.
- `loader-resolved-config-v3.json`, `unchanged-body-loader-trace-v3/{output.log,run.json,state.json,worker-10952.json}`: config-only preflight, worker runtime config,894PASS và6spanV3.
- `diagnostic-summary.json`: bản phân tích trước sửa harnessV3, giữ nguyên; **`diagnostic-summary-final.json` là bản tổng hợp57có phân biệtV1/V2/V3**.
- `quality-review-final.md`, `integrated-files.json`, `pending-acceptance.json`: review tooling, phạm vi docs/bảo toàn và disposition57; file sau cùng là57, không ghi đè manifest56.

Hai original56failed logs vẫn ở `D:/code/webkpimoi/.local/performance/customer-url-state-20261030/`:

| Log | SHA-256 |
| --- | --- |
| primary-scoped-tests.log |1117da29bf8e04e7ce982077b5357c73a6a7e86ec607df05d506883472f7f2da |
| worktree-scoped-tests.log |48d196b3ed79f6c8b4a13710e39b535872171246118b16d7c6350946a1a8434d |

Manifest56 và historical50/trace51 giữ nguyên; không sửa lịch sử failed gate vì diagnostic57pass. HEAD/index/oldBUILD_ID và mọi source/config/test đã snapshot phải được kiểm hash trước/sau tích hợp4docs; không chạm172thay đổi local cũ.

## Việc còn mở và bước tiếp theo

- **Auth timeout: chưa xong.** `originalFailureRootCauseProven:false`, `currentBatchScopedAcceptancePassed:false`, `releaseReady:false`. Không có application fix ở57.
- Cần failing trace trong điều kiện thực sự tái hiện để định vị import/handler/scheduling; báo rõ khác biệt harness. Không chạy lại liên tục tới khi xanh hoặc coi giả thuyết thiếu dữ liệu là nguyên nhân.
- Chỉ khi có bằng chứng: regressionRED đúng failure, sửa tối thiểu, review rồi fresh **uninstrumented** WT/primary QA; vẫn giữ401/no-schema/no-DB assertions. Không dời import khỏi budget chỉ để né timeout, tăng deadline, đổi pool hay skip test.
- Native Windows/libSQL crash, KPI-timeout, Node0TB strictvisual/timing, fullNext/router/hydration, staging3role/mobile và release acceptance còn riêng. Các diagnostics57không đóng những mục đó.

## Follow-up 58 — đọc metadata sẵn có, dọn warning cũ (30/10/2026, local)

### Đối chứng không thêm instrumentation vào worker

Đã đối chiếu runner56với57 và installed `createMethodsRPC`: Vitest tự ghi coordinator fetch durations vào `state.metadata` sau khi fetch/resolve/transform hoàn tất. Runner58 giữ nguyên lời gọi `startVitest(selected, { root, run:true }, { envDir:false })`, chỉ đọc metadata/test results **sau khi test chạy xong**, trước close. Không thêm setup/plugin/reporter/prototype wrapper, không transform thân test hay bật experimental collector.

Đúng **một lượt đối chứng trước cleanup**, cùng51file/894case trênWT: **894/894PASS**, targetGETusers503.34ms, retry0; chỉ setupgốc1lần/5000ms/forks/isolate unchanged. Không đo lại liên tiếp để lấy xanh. Điều này cho thấy lượt pass không chỉ xuất hiện khi gắn workerprofiler; **không giải thích ngược hai timeout56 và không chứng minh cold/warm/machine/flaky rootcause**.

Coordinator URL-level wall timings ghi nhận usersroute48.33ms, user.schema41.64ms, next/server1.70ms, zod0.69ms. Đây là metadata aggregate của fetch RPC, không có per-case attribution; không bao gồm mọi worker evaluation/wait và không phải import end-to-end/handler latency. Không cộng các số này, ghép với test503.34ms hoặc dùng làm số tốc độAPI/production. Không thay các metrics57 bằng metrics58.

### Cleanup chất lượng tách biệt với auth fix

Không có failing trace mới nên không sửa auth theo suy đoán. Chuyển sang ba warning cũ đã ghi nhận trong quality baseline của plan:

- `D:/code/webkpimoi/src/app/(dashboard)/map/MapComponent.tsx`: capture marker registry một lần **bên trong effect** sau readyguard, dùng cùng registry cho đăng ký và cleanup. Giữ guard `entry.cg === cg`, deps, popup/cluster/UI/CRUD và mọi handler khác; cleanup không đọc một `ref.current` mới.
- `D:/code/webkpimoi/src/app/api/node-0tb/upload/route.ts`: chỉ bỏ allocation `skippedRows` chưa từng đọc/ghi; giữ parse/date/row-skip/defaultcategory/upsert/response.
- `D:/code/webkpimoi/src/app/api/nodes/upload/route.ts`: chỉ bỏ helper `readSheetObjectRows` không caller; giữ `SheetRow` và matrix/import flow đang dùng. Không đổi schema/auth/quyền/deps/config hoặc dùng ESLint disable/ignore.

Đây là cleanup warnings, **không phải sửa timeout hoặc cải thiện tốc độ đã được đo**. Test public/fixtures/old assertions/mocks/resetModules nguyên; baseline894PASS đã có trước refactor. Sau sửa: focusedmap/read-only **42/42** trênWT; broadQA **mỗi rootWT/primary riêng51file894/894**, policy22/types nonincremental đạt và **ESLint toànsrc0error/0warning** với CLI `--max-warnings 0`, không sửa rule. Không cộng số test giữa các lượt; không chạy fullnative/build/production/device/browseracceptance.

Review độc lập đúng3whole-file hashes chỉ APPROVE cleanup; exact-scope checks bảo đảm chỉ ba edits mô tả trên. Tích hợp local có preimage/backup, source/docs defaultredactedsecret scan, whitespace và hash/inventory/HEAD/index/oldBUILD_ID guards. Chỉ3source+3docs; giữ174dirtypaths trước58,1624old artifacts và progress append-only. Không commit/push/deploy, không realenv/auth/DB hoặc bật menu đã bỏ.

Evidence riêng: `D:/code/webkpimoi/.local/performance/schema-auth-coordinator-trace-20261030/` chứa `starting-files.json`, `output.log`, `run.json`, `state.json`, `coordinator-summary.json`, `cleanup-scope.json`, preimages/backups, focused/broadQA, review/scans/integration/pending manifests. Không ghi đè bất kỳ artifact56/57 nào.

**Disposition:** cleanup local QA đạt không đồng nghĩa auth đã sửa. `cleanupCurrentBatchScopedAcceptancePassed:true`, `authTimeoutRootCauseProven:false`, `original56ScopedAcceptanceClosed:false`, `releaseReady:false`. Original56failed logs/manifest và57diagnosticpending giữ nguyên byte/hash. Cần failing trace đủ bằng chứng trước khi sửa auth; không để trạng thái Vitest `flaky:false` của một lượt pass trở thành kết luận test không thể tái diễn.
