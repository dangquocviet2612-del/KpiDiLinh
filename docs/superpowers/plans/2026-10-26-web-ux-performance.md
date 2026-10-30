# KpiDiLinh Web UX & Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Owner approved the local batch below, not deployment or every remaining step.

**Goal:** Tải dữ liệu nhanh hơn và thao tác dễ hơn trên cả máy tính/điện thoại, giữ nguyên nghiệp vụ, dữ liệu và phân quyền hiện có.

**Architecture:** Giữ Next.js/React/Prisma/libSQL. Tách setup khỏi request/build, hợp nhất vòng đời query, tối ưu critical path SQL rồi chia bundle theo view. Chỉ đổi giao diện ở những điểm đã xác minh; từng domain có regression test và checkpoint độc lập, không viết lại toàn bộ app.

**Tech Stack:** Next.js 16 (baseline 16.1.6, local batch 2 nâng 16.4.1), React 19, TypeScript, Prisma/libSQL/Turso, Vercel, SWR, Leaflet, Vitest/RTL, Playwright Core dùng Chrome cài sẵn. CI local config chuyển Node 24 phù hợp Vitest 5.

**Spec/evidence:** `docs/web-ux-performance-audit.md`; baseline source `1ecfa38`, ngày 26/10/2026. Người dùng xác nhận ưu tiên **cả desktop và mobile**. 46 mẫu hiện có là lab single-run, không phải p95/INP.

**Checkpoint local 26/10/2026:** Owner đã duyệt làm đợt đầu và xác nhận **chỉ hoàn thiện/kiểm thử local**, không commit/push/deploy. Batch này xử lý Task 2, phần lifecycle của Task 5, instrumentation/harness của Task 1 và riêng việc tách build khỏi migration của Task 3. Không coi toàn bộ đợt 1 hoặc 13 task là hoàn thành. Production vẫn giữ release trước; xem kết quả và giới hạn ở mục 16 của `tiendokpi.md`.

**Checkpoint batch 2:** Tiếp tục Task 3 với ledger/checksum/transaction trên database giả và vá dependency critical. Chặn database untracked, không tự baseline; chưa adoption/upgrade dữ liệu phục hồi hoặc rollout online. Xem `docs/migration-safety.md`, plan `2026-10-26-migration-security-local.md` và mục 17 của `tiendokpi.md`.

**Checkpoint batch 3, 26–27/10/2026:** Task 4 đã triển khai/kiểm thử trên fixture local: guard chỉ đọc cho 7 domain, migration 5 bổ sung index/default, bỏ GET auto-import Excel và hết 4 cảnh báo tracing. KPI readiness còn 2 SELECT cold/0 warm thay 49 setup statement, không phải tổng SQL hoặc cam kết latency. 27 response golden và 6 lượt Chrome qua 3 role giữ kết quả; 398 test + 22 policy test đạt. Restore được cấp quyền bổ sung default thiếu trong transaction, không seed trên GET. Chưa xác nhận runtime contract/adoption của database phục hồi hoặc online; không cutover, commit/push/deploy. Chi tiết và giới hạn ở mục 18 của `tiendokpi.md`, `docs/runtime-schema.md`.

**Checkpoint batch 4, 27/10/2026:** Phần đầu Task 6: metadata summary 2 reads → 1, personal và summary cước chạy query độc lập song song sau các gate cũ. 63 golden status/body hashes giữ nguyên qua native Prisma fixtures; 33 API responses và calculator/summary Chrome desktop/mobile đã đối chiếu. Có EXPLAIN local-only dùng chung SQL, không thêm index/region hoặc cache policy mới. Chưa benchmark cloud/real data, Task 6 còn EXPLAIN workload mục tiêu/region và rollout; chi tiết ở `docs/kpi-query-performance.md`, mục 19 của `tiendokpi.md`.

**Checkpoint batch 5, 27/10/2026:** Slice đầu Task 7 local: dependency invalidation CUOC/node/user/restore, cap/LRU/TTL của store kpi-cache, callback theo từng commit và cleanup cho import/fallback ghi một phần. 16 core/matrix test và 52 native mutation test đạt; giữ audit/SQL/transaction/API semantics. Có baseline mở rộng bị native worker crash, giữ log và không coi lỗi native đã được sửa. JWT revocation, shared version nhiều instance, in-flight refill và single-flight **chưa làm**, nên chưa hoàn thành Task 7/đợt 2. Xem `docs/cache-correctness.md`, `docs/cache-permission-gaps.md`, mục 21 của `tiendokpi.md`.

**Checkpoint batch 6, 27/10/2026:** Tiếp tục lifecycle Task 5 local cho summary/manager-summary: resource owners độc lập, key có scope ổn định, abort/ignore stale cả khoảng debounce, alias auto group/date, scope reset, view reentry và import latest-date/không fetch panel ẩn. Calculator thêm local data-revision sau import để không reuse alias cũ; không phải permission-version. 48 UI regression mới; checkout đạt 620 test + 22 policy. Chrome 8 case cùng fixture giảm initial report requests 4→1, payload hashes không đổi; retry/đổi ngày nhanh/back navigation đạt. Chưa gom shared `/api/me`/server hydration, chưa xử lý JWT hoặc invalidation đa instance; chưa hoàn tất Task 5/đợt 2. Xem `docs/kpi-summary-lifecycle.md`, mục 23 của `tiendokpi.md`. Batch 5 đã công bố tại `9d0365e`; batch 6 chưa commit/push/deploy.

**Checkpoint batch 7, 27/10/2026:** Server session hydration của Task 5: Providers nằm trong authenticated dashboard, nhận allowlist session từ `auth()` đã có; login vẫn static, focus/cross-tab/signout defaults giữ nguyên. Key id/name/role reset identity nhưng renew expires không làm mất draft. 20 regression mới; checkout đạt 640 test + 22 policy, types/build đạt. Chrome ba role × desktop/mobile giảm startup session request 2→0, report 1→1/hash khớp; DOM login/logout ba role và modal desktop/mobile đạt. Shared `/api/me` vẫn pending do GPS/CTV-list semantics khác nhau, Task 5/đợt 2 chưa hoàn tất. Xem `docs/session-hydration.md`, mục 24 của `tiendokpi.md`; batch 6–7 chỉ local, chưa commit/push/deploy.

**Checkpoint batch 8, 27/10/2026:** Shared me query chỉ gộp in-flight trong dashboard/identity, không thêm TTL/cache quyền. Giữ modal GPS success/edit exception và `/api/users`, giữ customer/KPI me.ctvList, fence selected/debounced CTV và import callback sau await. 56 regression mới; checkout đạt 696 test + 22 policy/types/build, login static, lint 2 warning không sửa. Hai review và Chrome sáu ca đạt (concurrent me 2→1, reopen +1, focus riêng +1, GPS/payload hash khớp, native login/logout ba role). Đã tích hợp local nhưng **full primary chưa nghiệm thu**: native worker crash 3221225477 ở test integration KPI không sửa, 694/696 test hoàn tất; không retry/skip để coi xanh. Chi tiết `docs/current-user-query.md`, mục 25 tiến độ. JWT/version/đa instance và toàn đợt 2 còn pending; batch 6–8 chưa commit/push/deploy.

**Checkpoint native investigation, 28/10/2026:** Bare libsql binding ngoài app/ORM/Vitest tái hiện 4/6 native crash trong GC stress; control node:sqlite và mode explicit close đều 6/6 pass, không suy ra workaround chắc chắn. Cùng source, file KPI 60/60 và một full instrumented run 696/696 đạt; Windows native reliability gate vẫn mở, không auto-retry/skip/đổi pool để coi hết lỗi. Không sửa application/dependencies hoặc cài môi trường toàn máy. Xem `docs/native-crash-investigation.md`, mục 26 tiến độ; giảm bundle/UI vẫn là phần roadmap riêng, chưa push/deploy.

**Checkpoint generation fence, 28/10/2026:** Tiếp tục Task 7 local: một token generation cho store; mọi production writer capture tại entry trước await/auth/scope và bỏ cache publication nếu invalidation xen giữa. Invalidation store rỗng vẫn đổi token; stale write không được xóa/ghi đè/evict giá trị mới. Unrelated settled entries giữ nguyên, ongoing fills bị fence bảo thủ kể cả prefix khác. Không single-flight, không hủy response cũ, không sửa JWT/revocation hoặc đồng bộ nhiều process. RED có 14 semantic fail/4 pass; kết quả candidate/primary và gate tại `docs/cache-generation.md`, mục 27 tiến độ. Native Windows reliability vẫn mở; chưa push/deploy.

**Checkpoint lazy panel UI, 28/10/2026:** Slice đầu Task 8: personal static, mười panel UI khác dùng literal next/dynamic SSR mặc định. Hooks/state/API/CSS vẫn giữ trong shell, business body byte-identical; không coi đã tách view owner.20 regression mới, full candidate753 test+22 policy/types/lint/build đạt.34 ca Chrome cùng fixture giữ hash API báo cáo/me/users và settled UI; personal JS decoded783.436→638.158 byte (-18,54%), script responses12→14. API hoàn tất trong khi chunk calculator bị giữ pending; lỗi chunk có cảnh báo draft và full reload phục hồi thật. Back giữ ngày/CTV, nhưng baseline vốn reset draft khi forced reentry refresh settle; không sửa/khẳng định giữ draft vĩnh viễn. Xem `docs/prepaid-panel-loading.md`, mục28 tiến độ cho integration/primary gate. Chưa push/deploy, native Windows gate vẫn mở.

**Checkpoint calculator draft, 28/10/2026:** Follow-up lỗi đã xác minh ở slice bundle: override cùng scope/CTV/ngày được giữ sau reentry/Refresh và sau response về, ô chưa sửa cập nhật default mới. Reset/đổi context/logout/import revision bỏ override; một context in-memory, không lưu qua reload/unmount. Reset dùng hasDraftEdits để không bị khóa chỉ vì score delta bằng0, giữ dirtyCount/công thức cũ. R2 có62 test mới, full815+22policy/types/lint/build đạt;34 Chrome report/API/settled UI khớp và6 ca draft trước false→sau true, reset/context đúng. P2 inherited-name lookup có regression riêng và đã sửa trước QA cuối. JS personal639.813 byte, thêm1.655 byte so slice bundle nhưng vẫn dưới baseline eager783.436; không claim tăng tốc mới. Gate tích hợp/primary tại mục29 và `docs/kpi-calculator-drafts.md`. Chưa hoàn tất Task8/native, chưa push/deploy.

---

## 1. Quyết định đề xuất

**Checkpoint Node0TB map projection, 28/10/2026:** Owner đã chọn tiếp Task9 local với native warning giữ mở. API opt-in projection=map gửi8field marker đang dùng; mặc định/unknown mode giữ legacy, SQL/matching/stats/search/auth/DELETE/upload/template không đổi.26unit+11UI mới, semanticRED12fail→GREEN53; WT387scoped+22policy/types/lint/build đạt. Size-only mapper1k/10k/50k giảm44,32–51,44%, không phải SQL/latency/50k-browser benchmark. Browser actual DTO6166→3203byte(-48,05%), legacyhash và72tóm tắtUI khớp (không phải fullDOM). Strictvisual vẫn FAILED:45/48PNG khớp,3PNG/2errorgeometry khác chưa rõ nguyên nhân. Review chỉ chấp nhận functional checkpoint local, không waive image gate; gate primary/integration ở mục32, `docs/node0tb-map-projection.md`. Chưa hoàn tất slice/Task9/native hoặc publish.

**Checkpoint native stable audit, 28/10/2026:** Sau primary crash ở cache-invalidation.test.ts, đã đối chiếu npm0.5.29/gitHead55bee86 với source release/core0.9.30. Source vẫn thiếu raw-null disconnect và pin function của hai upstream fixes; chưa có verified fixed stable candidate để nâng trong repo. Không cài package, đổi app/test/pool hoặc rerun native suite;323source giữ nguyên,67 thay đổi trước được bảo toàn. Chưa đóng Windows gate hoặc xác minh frame crash mới; Linux cần thống nhất môi trường riêng. Task9 payload bản đồ là hướng độc lập được đề xuất, chưa triển khai ở audit này. Chi tiết `docs/native-crash-investigation.md`, mục31 tiến độ; không push/deploy.

**Checkpoint CSS công văn, 28/10/2026 — không nhận candidate:** Source extraction71class/99rule và48visual/6draft đạt, nhưng build vẫn gom document rules với shared panel CSS.34case runner dừng ở gate: personal decoded CSS164.879→165.001 byte (+122),3stylesheet giữ nguyên. Không nới gate/đổi SSR/bundler; lưu candidate rồi hoàn nguyên đúng4file, giữ65 thay đổi local trước. Chỉ ghi tài liệu, Task8 vẫn partial. Full candidate823test không phải số test hiện tại sau phục hồi: primary801/815 hoàn tất rồi native worker3221225477 tại cache-invalidation.test.ts; không retry.22policy/types/lint độc lập đạt,323source khớp nhưng không đóng full-suite/native gate. Chi tiết mục30 và `docs/official-docs-css.md`; chưa push/deploy.

| Cách làm | Lợi ích | Đánh đổi | Quyết định |
|---|---|---|---|
| A. Tối ưu tuần tự, giữ giao diện/stack chính | Dễ đo trước/sau, rollback theo domain, ít ảnh hưởng công thức/dữ liệu | Cần giải quyết lifecycle/query trước khi thấy giao diện khác | **Khuyến nghị** |
| B. Thiết kế lại toàn bộ UI cùng lúc tối ưu | Thay đổi hình ảnh rõ | Khó biết thay đổi nào giúp nhanh; regression rộng, chưa có yêu cầu đổi nhận diện | Không chọn lúc này |
| C. Đổi framework/database/cache service trước | Có thể hữu ích nếu workload thực tế đòi hỏi | Migration/cost/ops tăng; chưa chứng minh stack hiện tại là giới hạn | Chưa có cơ sở |

Không đổi màu toàn app, công thức KPI, cách tính ngày/rounding, phạm vi CTV, cấu trúc dữ liệu khách hàng hoặc provider chỉ để “làm mới”. Không tự mua/bật dịch vụ thu phí.

## 2. Thứ tự triển khai và điều kiện qua đợt

| Đợt | Việc chính | Người dùng nhận được | Gate |
|---|---|---|---|
| 1 — Baseline + an toàn | Task 1–3 | Không xóa dữ liệu do chỉ xem trang; build không replay migration | Backup/restore staging, GET đọc 0 business writes (trừ cron đã xác thực), migration idempotent |
| 2 — KPI nhanh và đúng | Task 4–7 | Bớt spinner/request lặp, đổi bộ lọc không giật/lệch dữ liệu | Trace/query count, snapshot KPI, 3-role/cache tests |
| 3 — Giảm lượng tải | Task 8–10 | Không tải cả bộ panel, bản đồ gọn, báo cáo dữ liệu lớn hiệu quả | Bundle/network budget, marker/totals reconciliation |
| 4 — UI desktop/mobile | Task 11 | Cột không chồng, nút dễ bấm, card gọn, loading/error rõ | 360/390/768/1024/1440, light/dark, keyboard/axe |
| 5 — Vận hành + rollout | Task 12–13 | File lớn/backup đáng tin hơn, có cảnh báo regression tốc độ | Chi phí được duyệt, restore drill, CI/RUM, rollback |

Task 5 có thể làm song song với 3–4 sau khi có baseline; Task 11 chỉ cần ổn định hợp đồng dữ liệu liên quan. Test/QA chạy **trong từng task**, không chờ đến đợt 5. Task 12 là subproject riêng nếu thêm storage/job provider; không chặn các quick win KPI/UI.

Không cam kết số ngày hoặc phần trăm tăng tốc khi chưa có SQL trace và scope triển khai được duyệt. Mỗi đợt nên là một release nhỏ, chỉ deploy khi owner cho phép.

## 3. Guardrails bắt buộc

- Chỉ dùng database staging riêng và fixture giả/anonymized để benchmark, migration, import, purge và browser write tests. Không clone raw backup khách hàng vào Git/CI.
- Không `migrate reset`, không drop/rebuild trực tiếp Production để thử, không dùng chung Turso Production cho Preview.
- Giữ nguyên KPI âm, KPI cước N1–N3, default `CUOC_N1_N3_RATE`, ngày fallback, target/max-percent, manager secondary-code, customer-node mapping và thứ tự exact/base/prefix.
- Cache/query phải giữ scope ở server. Không cache public dữ liệu cá nhân; test đổi role/manager/CTV/session revocation trước khi chấp nhận cache mới.
- Bản sửa DOM `customerNodeName` → payload `nodeName` và regression test hiện tại phải được giữ. Thêm smoke Chrome thật thay vì chỉ dựa vào jsdom.
- Công cụ audit và số liệu/ảnh riêng tư ở `.local/`; không commit token, file env, backup, cookie, tên/SĐT/account khách thật.
- Hạn chế chia lại CSS/component vào đúng domain đang sửa. Không mass-format/refactor/upgrade dependencies toàn repo trong cùng commit hiệu năng.

## 4. Tasks

### Task 1 — Baseline lặp lại được và instrumentation

**Priority:** P0, nền tảng. **Dependencies:** Không.

**Files:**
- Create: `scripts/performance/browser-baseline.mjs`, `scripts/performance/summarize-baseline.mjs`.
- Create: `src/lib/server-timing.ts`, `tests/unit/server-timing.test.ts`.
- Create: `tests/e2e/performance-readonly.spec.ts`, `tests/fixtures/performance/README.md`.
- Modify: `package.json`, `.github/workflows/ci.yml`; tách Playwright config khỏi Vitest config.
- Modify có giới hạn: `src/app/api/kpi/report/route.ts`, `src/app/api/kpi/summary/route.ts` để gắn timing đã redact.

- [x] Viết test FAIL: trace không chứa SQL params/PII/token; browser harness chặn mutation và GET archive có side effect.
- [x] Port harness tạm thành tool repo tái lập được; output artifacts riêng tư, không ghi session/response bodies vào report công khai.
- [x] Gắn phase `auth`, `schema`, `scope`, `date`, `query`, `compute`, `serialize`, `total`, cache-hit/miss trên report/summary; không log username, customer account hoặc token.
- [ ] Đo số SQL statements thực tế; phase `query` là tổng thời gian nhánh đọc, không phải bộ đếm query.
- [ ] Định nghĩa UI mark “report-useful-data” sau khi đúng filter có dữ liệu; không dùng LCP hoặc API cuối thay thế.
- [ ] Đo tối thiểu 10 mẫu initial/revisit trên cùng dataset cho bản so sánh nhỏ; chỉ gọi là p95 với sample/window được ghi rõ, bổ sung RUM cho p75 field.
- [ ] Lưu baseline desktop/mobile, request count, decoded/transfer bytes, CLS và lỗi; test warm/cold-browser riêng, cold Function chỉ khi được xác nhận.

**Acceptance:** Có benchmark replay và report có methodology; không có thao tác nghiệp vụ trên Production. Bảo vệ nguồn dữ liệu/private artifacts được kiểm tra tự động.

### Task 2 — GET đọc archive không được mutate, giữ export/cron safeguard

**Priority:** P0, an toàn dữ liệu. **Dependencies:** Fixture staging của Task 1.

**Files:**
- Modify: `src/app/api/archive/status/route.ts`, `src/app/api/archive/export/route.ts`, các route `archive/confirm`, `archive/cancel`, `archive/purge`, `archive/cron`.
- Modify: `src/app/(dashboard)/archive/page.tsx` để caller export chuyển sang POST có xác thực.
- Modify: `src/lib/archive.ts`.
- Create: `tests/unit/archive-request-safety.test.ts`, `tests/integration/archive-worker.test.ts`, `tests/integration/archive-export-readiness.test.ts`.

- [x] Viết test FAIL đếm business writes/purge khi GET status/export cũ hoặc request 401/403, kể cả có archive quá hạn. Tách case GET cron có secret hợp lệ: đây là scheduler execution được phép ghi, không phải request đọc.
- [x] Xác thực/phân quyền trước mọi side effect; bỏ auto-purge khỏi đường đọc và các request không được phép.
- [x] Chuyển thao tác tạo file export + `recordArchiveExport` sang POST authenticated ADMIN; cập nhật `handleExport` của UI và test. Chỉ ghi log sau khi tạo file thành công; không xóa log/safeguard để đạt tiêu chí GET-readonly. GET cũ trả 405/Allow: POST và hướng dẫn tải lại UI. Caller ngoài repo nếu có phải đổi method trước rollout.
- [x] Test chuỗi export mới → confirm thành công; chưa export/export lỗi/export cũ sau khi dữ liệu thay đổi → confirm bị chặn. Giữ semantics `getArchiveExportReadiness` và log freshness hiện có.
- [x] Giữ cả GET/POST cron có xác thực để lịch Vercel vẫn chạy; chỉ secret hợp lệ mới được purge. Claim bằng conditional UPDATE và DELETE trong cùng transaction, rollback claim khi lỗi; không thêm bảng lease hay đổi cron contract.
- [x] Test hai worker, worker restart và lỗi giữa batch; không làm mất archive chưa đến hạn hoặc vừa bị cancel. Test SQLite worker dùng transaction adapter giả lập tuần tự; chưa thay thế kiểm thử contention nhiều process trên Turso.
- [x] Verify UI export/confirm/cancel trên preview dùng database giả, GET status không xóa dù có archive quá hạn. Kiểm tra thêm hai HTTP cron GET/POST đồng thời qua PrismaLibSql thật: tổng purge 1, chạy lại 0. Đây là một process local, chưa phải kiểm thử contention nhiều process trên Turso.
- [x] Regression đọc DATETIME qua PrismaLibSql ở UTC và UTC+7: giữ timestamp dạng text có precision, tránh lệch 7 giờ làm export mới bị coi là cũ. Không đổi điều kiện expiry SQL.

**Acceptance:** GET đọc (status/export legacy/download) và mọi unauthorized request có 0 business DB writes/purge. GET cron có xác thực là ngoại lệ tường minh, phải tiếp tục chạy cleanup theo lịch. POST export tạo đúng log/freshness để confirm không bị hỏng hoặc bị bỏ qua safeguard; một tháng không purge trùng. Existing transaction và typed-confirmation UI vẫn giữ.

### Task 3 — Migration có kiểm soát, build không đụng database

**Priority:** P0. **Dependencies:** Backup/restore staging được xác minh.

**Files:**
- Modify: `package.json`, `scripts/migrate.mjs`, `.github/workflows/ci.yml`.
- Create: `scripts/release-migrations.mjs`, `tests/integration/migration-runner.test.ts`, migration ledger/backfill theo thiết kế đã duyệt.
- Modify: `docs/deploy-online.md`.
- Read/preserve: `prisma/migrations/*/migration.sql`, đặc biệt `20260920000002_fix_node0tb_id`.

- [x] Regression test FAIL/GREEN cho command build không gọi migration; build thật trên fixture không đổi SHA-256 SQLite.
- [ ] Negative test build với DB credential online chỉ đọc; chưa dùng credential/DB thật để kiểm tra.
- [x] Migration trên fixture managed chạy lần hai no-op, không replay rebuild Node0Tb; wrapper mặc định check, apply tường minh, không tự đọc env hay chọn database mặc định.
- [x] Thiết kế hàng rào baseline: refuse database untracked/ledger rỗng không hợp lệ, giữ nguyên SQL lịch sử; checklist snapshot/schema/index/default/foreign keys/content checksum trong `docs/migration-safety.md`.
- [ ] Thực hiện verified baseline/adoption và upgrade trên bản sao fixture/anonymized của database phục hồi; không đánh dấu applied chỉ dựa vào tên bảng/số dòng. Chưa cho phép chạy target thật.
- [x] Runner libSQL ghi version/checksum chuẩn hóa line endings, recheck sau write lock; DDL/data/ledger commit nguyên tử theo version, checksum/history drift fail-closed, rollback khi lỗi. Có compatibility rule tường minh cho đúng cột expirationDate bị lặp trong hai SQL lịch sử, không generic-ignore lỗi.
- [x] Tách `scripts/migrate.mjs` khỏi `build`; `build` chỉ còn `next build`, có regression test cho command. `db:migrate` vẫn là runner legacy tường minh, không chạy trên database đã có dữ liệu.
- [ ] Hoàn thiện release migration step riêng trên đúng target với ledger, backup và quyền riêng; việc tách command không chứng minh runner idempotent.
- [x] Fault-injection sau DROP và RENAME trong SQL rebuild Node0Tb thật: giữ rows/schema/ledger cũ, không còn bảng tạm; retry thành công và foreign key check sạch trên fixture. Hai client độc lập chỉ commit một lần mỗi version.
- [ ] Đối soát content checksum toàn bộ database mới và bản nâng cấp/anonymized có đủ runtime schema; SQLite local không thay thế contention multi-process/region trên Turso.
- [x] Tài liệu hóa rollback source vs rollback data, giới hạn JSON backup không lưu ledger; không ghi đè dữ liệu phát sinh sau snapshot khi rollback.

**Acceptance:** Build thuần không kết nối DB để migrate. Fresh install và upgrade đều đủ schema, migration lần hai no-op, interrupted migration không để bảng dở dang.

### Task 4 — Loại runtime schema/seed khỏi hot path

**Priority:** P1, tốc độ backend. **Dependencies:** Task 3.

**Files:**
- Modify: `src/lib/kpi-db.ts`, `src/lib/ensure-customer-schema.ts`, `src/lib/node-0tb-db.ts` và các ensure helper thật sự được route gọi.
- Modify: `src/app/api/users/route.ts`, `src/app/api/kpi/report/route.ts`, `src/app/api/kpi/summary/route.ts`, `src/app/api/cuoc-cd/report/route.ts`.
- Create: `tests/integration/runtime-schema-contract.test.ts`; thêm migration cho đủ runtime-only schema/index/default rows.

- [x] Inventory DDL/seed trong runtime ensure đang được dùng, so với migrations; gồm `CUOC_N1_N3_RATE` và schema tài khoản/GPS. Endpoint `/api/setup` bị disabled/blocked không chuyển thành công cụ setup mới.
- [x] Viết test FAIL: guard mới chỉ SELECT trên fixture đã migrate; golden GET/native browser xác nhận schema và dữ liệu không đổi. Tách structural-only backup khỏi full readiness để không cache nhầm.
- [x] Chuyển 6 index thiếu và 3 default sang migration mới, giữ SQL lịch sử. Runtime kiểm tra contract, không ghi ledger hoặc tự adoption; bỏ GET auto Excel, giữ import thủ công. POST restore bổ sung default thiếu trong transaction như invariant của restore.
- [x] Khi schema/default chưa đủ, báo `SCHEMA_NOT_READY`; không biến ensure thành no-op hoặc ghi đè rate tùy chỉnh. Hỗ trợ UNIQUE đảo thứ tự cột nhưng từ chối partial/expression key thay UNIQUE đầy đủ.
- [x] Chạy test mới/cũ, 27 response hash/status qua 3 role và 6 lượt Chrome desktop/mobile; đối chiếu KPI/users/customer/cuoc-CD/Node0TB/node, giữ phân quyền. Build đạt, hết 4 cảnh báo tracing; không suy diễn cloud latency.
- [ ] Gate rollout riêng: preflight snapshot/target thật được duyệt, verified adoption/upgrade nếu cần, restore drill và owner cho phép cutover. Chưa thực hiện trong batch local này.

**Acceptance:** Không còn chuỗi 49 setup call-site trên request path; warm hit không `ALTER`/`COUNT` để auto-seed. Chỉ khẳng định mức tăng tốc sau trace.

### Task 5 — Một nguồn tải báo cáo, không fetch lặp

**Priority:** P1, quick win. **Dependencies:** Task 1; có thể song song Task 3–4.

**Files:**
- Modify: `src/app/(dashboard)/prepaid/PrepaidPageImpl.tsx`, `src/app/(dashboard)/prepaid/useKpiCalculator.ts`.
- Create: `src/hooks/useKpiReport.ts` hoặc query resource tương đương có key/scope rõ ràng.
- Review: `src/components/Providers.tsx`, `src/app/(dashboard)/layout.tsx`, `src/app/layout.tsx` cho session hydration; không phá login/provider boundary.
- Create: `tests/ui/kpi-request-lifecycle.test.tsx`; retain `tests/ui/kpi-calculator.test.tsx`, `tests/ui/summary-kpi.test.tsx`.

- [x] Viết test FAIL cho calculator tải cả personal ẩn + calculator, callback đổi identity, ngày auto-resolve và đổi CTV nhanh.
- [x] Tách rõ owner dữ liệu: calculator không chạy effect personal; một key report chỉ có một request in-flight.
- [x] Chốt CTV/ngày khởi tạo một nhịp; callback ổn định; dedupe cả lúc chưa có data. Response tự resolve ngày không làm vòng lặp query.
- [x] Abort request lỗi thời và chặn stale response ghi đè; không tự reset draft khi callback rerender. Key theo user id/name/role/CTV/date; reset khi scope đổi và sau import. Refresh tường minh vẫn nạp dữ liệu/draft mới như trước.
- [x] `/api/me` chỉ khởi tạo lại khi auth scope đổi, không do đổi CTV hoặc session object tương đương; thêm regression post-import lấy ngày mới, không giữ alias report cũ.
- [x] Summary/manager dùng resource owner độc lập, scope key ổn định; dedupe pending, abort khi filter/view/scope đổi, alias auto group/date, refresh/retry/reentry và import không gọi panel ẩn. Giữ manager `__all__`, import date và regression personal/calculator.
- [x] Hydrate session từ server trong authenticated dashboard layout, chỉ truyền allowlist fields; giữ login static, auth/redirect và focus/cross-tab/signout defaults. Key id/name/role để reset identity nhưng không reset draft khi chỉ renew expires. Regression và bằng chứng tại `docs/session-hydration.md`, mục 24 của `tiendokpi.md`.
- [x] Shared `/api/me` chỉ gộp in-flight trong dashboard/session identity, parse một lần, cancel theo consumer và bỏ late result/subject mismatch. Không settled-cache/TTL quyền, reopen vẫn đọc server, focus/online/refresh revalidate. Giữ khác biệt GPS và modal `/api/users`, fence CTV/report/import; 56 regression mới và Chrome ba role desktop/mobile. Gate primary/công bố tại mục 25; JWT/version/đa instance vẫn là Task 7 pending.
- [x] Calculator explicit overrides giữ sau settled same-context reentry/Refresh, fresh defaults vẫn cập nhật; Reset khả dụng cả khi điểm không đổi. Context/alias/ABA/logout/pruning có62 regression và6 Chrome cases. Không lưu draft qua reload/unmount; policy và gate mục29, `docs/kpi-calculator-drafts.md`.
- [x] Browser summary/manager: 8 case initial/refresh desktop/mobile qua ADMIN/MANAGER, 2 case retry/đổi ngày nhanh và 2 case history/back thật; same-scope previous data/refreshing còn có 48 UI regression. Chưa coi đây là toàn bộ browser interaction/3-role acceptance của mọi view.

**Acceptance:** Không còn chuỗi 10/11 request report khi mở calculator. Mỗi intent/key có 1 in-flight, tối đa một follow-up auto-date có lý do; không request panel ẩn; KPI/draft/totals giữ đúng.

### Task 6 — Critical path KPI, index và thử nghiệm region

**Priority:** P1. **Dependencies:** Task 1, 4; đo frontend riêng với Task 5.

**Files:**
- Modify: `src/app/api/kpi/report/route.ts`, `src/app/api/kpi/summary/route.ts`, `src/app/api/kpi/manager-summary/route.ts`, `src/lib/prepaid-query.ts`.
- Create: `tests/integration/kpi-report-equivalence.test.ts`, `scripts/performance/explain-reports.mjs`.
- Modify có điều kiện: `prisma/schema.prisma`, migration mới, `vercel.json` nếu benchmark region/index được duyệt.

- [x] Fixture native Prisma/golden cho 3 role, metric dương/âm, cước N1–N3, ngày thiếu dữ liệu/fallback, whitespace/case/Unicode và scope; 63 status/full-JSON hashes cùng assertion công thức cụ thể.
- [x] Hợp nhất summary config metadata, chạy song song personal rows/target/cước và summary cước target/same-date sau gate cũ; giữ JOIN/GROUP BY, scope/cache policy. Manager-summary route chưa tối ưu trong slice này.
- [ ] Đo query count/rows/serialize; dùng mục tiêu tối đa 4 logical report reads sau resolve scope khi hợp lệ, ghi riêng guard/metadata miss.
- Đã có quan sát native proxy: summary explicit-date cold 6→5 logical reads sau mock auth, metadata 2→1, warm0; 15→15 metadata rows trên fixture. Chưa coi đây là hoàn tất trace/budget auth/cloud cho mọi nhánh.
- [ ] EXPLAIN staging với dataset giả nhỏ/lớn; chỉ thêm/hợp nhất index có tác dụng, xét write cost và expression `UPPER/LOWER`.
- Đã thêm tool EXPLAIN local-only, fixtures 12/1.984 dòng và fixture app managed; JOIN/aggregate/latest-date dùng index hiện có. Chưa đo workload staging mục tiêu hoặc thêm index vì metadata scan/sort đơn lẻ chưa đủ bằng chứng.
- [ ] Xác minh DB placement/RTT; API hiện ở `iad1`. So sánh preview gần DB với cùng workload, không suy ra region API từ middleware toàn cầu.
- [ ] Chỉ pin region/index sau khi có bằng chứng cải thiện và phương án revert. Preview phải có DB riêng, không replay migration lên Production.

**Acceptance:** Payload/công thức/rounding khớp baseline; trace ngắn hơn. Budget staging đề xuất warm p50 ≤1 s/p95 ≤2,5 s cần chốt qua Task 1, không coi single-run hiện có là p95.

### Task 7 — Cache đúng dependency và quyền truy cập

**Priority:** P1, correctness trước hit ratio. **Dependencies:** Task 1, 4.

**Files:**
- Modify: `src/lib/kpi-cache.ts`, `src/lib/scope.ts`, `src/lib/api-auth.ts`, `src/auth.ts` nếu cần session/permission version.
- Create: `src/lib/cache-tags.ts`, `tests/integration/cache-invalidation.test.ts`, `tests/integration/permission-revocation.test.ts`.
- Modify đúng dependency: `src/app/api/cuoc/import/route.ts`, user mutation routes, node upload/search routes, restore route và customer/report lookup liên quan.

- [x] Regression same-process: import/config cước làm mới KPI summary; upload node làm mới `node:search` và customer list khi mapping đổi; user đổi manager scope/restore xóa cached customer/report cũ. Auth fixture giữ nguyên role; không coi đây là chứng minh JWT/đa instance đã revoke quyền.
- [ ] Lập tag/dependency matrix, invalidate sau commit thành công; restore cũng phải đổi version/invalidate đầy đủ.
- Đã có matrix typed và clear store trong process sau write đã commit, kể cả request 500 vì commit một phần; full rollback/no-write/no-op giữ cache. Chưa có version dùng chung hoặc invalidation process khác.
- [ ] Key dùng stable identity và scope/permission version; scope được xác minh trước trả private cache.
- [ ] Bổ sung bound/eviction, TTL và single-flight; không dùng TTL đơn thuần làm cơ chế thu hồi quyền.
- Bound/LRU tối đa 1.000 entry và TTL/prune đã có test RED/GREEN; generation chống stale refill cùng module/store được bổ sung ở slice local 28/10. Chưa có byte budget hoặc single-flight. TTL/token này không được coi là SLA quyền hay shared version.
- [x] Same-process stale refill fence: entry token trước async work, kiểm token trước mọi cache mutation; runtime deferred races và AST inventory/wiring. Chi tiết/gate tại `docs/cache-generation.md`; không đóng request authorization, JWT hoặc race nhiều process.
- [ ] Test với hai instance/process. Chọn shared version/invalidation nhẹ phù hợp; Redis hoặc dịch vụ trả phí chỉ là lựa chọn sau benchmark/duyệt chi phí.
- [ ] Chốt và test SLA revocation khi đổi role, manager, xóa user/đổi mật khẩu; không hy sinh bảo mật để giảm query.

**Acceptance:** Không stale dữ liệu/scope ngoài policy khi cache hit; cache không tăng không giới hạn theo key; hit/miss và invalidation quan sát được.

### Task 8 — Chia bundle report theo view, giữ shell ổn định

**Checkpoint KPI fixture isolation, 29/10/2026, mục 38:** Chỉ harden test local, không sửa app hoặc publish. Hai regression chứng minh registered panel factory/component có thể ghi vào observation bucket của lần kế tiếp; capture refs tại registration và dùng đúng set trong mount/cleanup. Giữ nguyên 20 testcase cũ và real Next dynamic, không tăng timeout/đổi pool. RED hai semantic fail → GREEN 78/78 hai file. Baseline/trace không tái hiện timeout KPI; broader trace 571/572 với timeout GET-users không thuộc KPI được giữ riêng. Không coi lỗi fixture này là nguyên nhân timeout cũ hoặc đóng broader reliability gate. Kết quả QA/tích hợp cuối ở mục 38, chi tiết `docs/kpi-test-isolation.md`; Task 8/13 và native/visual/performance/release vẫn mở.

**Priority:** P1. **Dependencies:** Task 5.

**Files:**
- Modify: `src/app/(dashboard)/prepaid/PrepaidPageImpl.tsx`, `PrepaidPageClean.tsx`, `kpi.module.css` trong cùng thư mục.
- Create dần: `src/app/(dashboard)/prepaid/views/PersonalKpiView.tsx`, `SummaryKpiView.tsx`, `ManagerKpiView.tsx`, `CalculatorView.tsx`; thêm view container cho billing/CDT/docs theo nhóm riêng.
- Retain panel/hook hiện có trong mỗi view; tạo CSS module theo domain khi cần, không đổi mọi class trong một lượt.
- Test: `tests/ui/prepaid-view-loading.test.tsx`, browser bundle budget.

- [ ] Ghi bundle baseline, tìm module nặng thực tế; không quy server-only `xlsx` import thành client JS.
- [x] Baseline slice UI imports:34 ca đều783.436 byte JS decoded/12 scripts,10 panel UI bị import eager; sau lazy personal638.158 byte (-18,54%). Không gán chi phí cho server-only dependency hoặc tuyên bố phân tích đầy đủ từng package.
- [ ] Viết test FAIL đảm bảo mở personal không mount/fetch calculator/docs/CDT; skeleton giữ đúng layout.
- [x]20 regression cho module evaluation/mount/off-view API, pending loading/accessibility và recovery. Skeleton dùng container/template cũ; chưa đo CLS đầy đủ từng view.
- [ ] Router shell chọn `next/dynamic` view; chuyển hook/state của panel vào container của chính view, giữ filter/URL contract và scope.
- Đã lazy mười leaf panel, SSR giữ nguyên; hooks/state còn ở shell có chủ đích để không đổi lifecycle. View/hook ownership extraction chưa làm.
- [ ] Tách CSS chọn lọc, preload theo intent nếu cần; test quyền và link trực tiếp từng `view=` hiện có.
- Thử riêng CSS công văn ngày28/10 không đạt compiled-loading gate (personal+122byte); đã giữ application baseline, không đánh dấu checkbox này hoàn tất. Không dùng source split/visual pass thay bằng chứng network. Xem `docs/official-docs-css.md`, mục30 tiến độ.
- [ ] So lại network bytes, render và 10 view desktop/mobile; reject code splitting tạo waterfall dữ liệu mới.
- [x] Slice cold decoded JS/settled render:34 Chrome cases, API hash/count/status và UI khớp; actual compiled App Router report API hoàn tất trước khi nhả calculator chunk. Không phải compressed bytes/latency/p95 hoặc slow-network/thiết bị thật.

**Acceptance:** Panel chưa mở không nằm trong entry tải ban đầu nếu không cần; mục tiêu thử giảm 15–25% JS giải nén phải được xác nhận, không ghi là kết quả trước đo. Không đổi API/công thức.

### Task 9 — Marker DTO nhẹ trước, viewport sau nếu cần

**Checkpoint nearest-node cache, 29/10/2026, mục 39:** Local fallback helper cho create/update khách hàng, không thay giao diện. Gộp cold/expired coordinate read trong cùng process/generation; token chặn old read republish sau invalidation và finalizer không xóa pending mới. Giữ Prisma projection/Haversine/tie/null/zero/TTL. 18 regression: RED 10 semantic fail/8 pass → GREEN 18/18; burst giả 1/10/100 callers từ 1/10/100 thành 1/1/1 `findMany`, không phải SQL toàn API hoặc latency measurement. Old caller có thể nhận snapshot cũ, không cancel/linearizability/distributed claim. Kết quả QA/tích hợp tại mục 39, `docs/nearest-node-cache.md`. Chưa đóng Task 7/9, timeout KPI/native/visual/Node0TB timing/performance/release; chưa publish.

**Checkpoint customer marker identity/lifetime,29/10/2026,mục37:** Local theo yêu cầu dừng publish. Dùng ID/publicsourceTarget thay coordinateepsilon, đợi đúngflightmoveend rồi mởpopup, hủy pending/stale callbacks và cleanupref đúnggroupowner khi filterđổi. TDD identity6RED→19GREEN, motion6RED→25GREEN, lifetime2RED→27GREEN; giữ12casecũ. Final WT10file/256map-domain+22policy/types/lint/build và Chrome3role×390/1440đạt trênDB/API/providergiả; không phảifullscope/backendscope/pixel/latencyclaim. BrowserV1popupfail/V2optionalclassfail/probe và broad-prepaidtimeouts giữ nguyên. Tất cả14customer/10general-node fields đều đangdùng nên chưa cắtDTO mộtcách cơhọc. Chi tiết `docs/customer-marker-identity.md`, primary/integration tại mục37; broader/native/strictvisual/performance/Task9/release còn mở, khôngpublish.

**Checkpoint timing investigation, 29/10/2026, mục36:** Chỉ diagnostic +5tài liệu, không sửa app. Tám fresh processes theo preregistration,12workloads/process, input/output/read/counter invariants khớp, không retry/optional branch. Observer history làm unique50k chậm ở cả hai sources/repetitions nhưng interaction1,086 rồi0,967 chưa giải thích anomaly2,5× cũ; secondary unique138/exact có timing sau cao hơn, không universal speedup/no-regression claim. Giữ89dirty paths/331source files/161artifacts cũ. Chi tiết `docs/node0tb-timing-investigation.md`; unique/performance/native/strictvisual/Task9/release còn mở, chưa publish.

**Checkpoint Node0TB prefix memo, 29/10/2026:** Đo actualservice rồi thêm bounded memo tối đa1.000base trong từng getNode0TbList, giữ exact→base→firstprefix và cache cả miss; không SQL/readiness/UI/DTO/auth changes.39test semanticRED33fail→GREEN39, WT34file/557scoped+22policy/types/lint/build/staticlogin đạt.12syntheticdatasets fullJSONhashes khớp: grouped50k scans50.000→100/visits49.387.500→98.775,exact0/unique1scan mỗirow không giảm,2backendreads giữ nguyên. **Timing performance chưa nghiệm thu:** initialunique50k614,184→1.526,097ms; sameprocesspaired5sample417,133→423,051ms không tái hiện mức chậm lớn nhưng chưa rõ nguyên nhân/không chứng minh zero regression. Không gọi là flake/vô hại/nhanh toàn web. Quality/runtime/primary/integration disposition tại mục35, `docs/node0tb-prefix-memo.md`; native/strictvisual/Task9/release còn mở, chưa publish.

**Checkpoint bulk customer-node reads, 29/10/2026:** Chỉ đổi read-helper chunk300→900, giữ toàn bộ SQL/normalization/auth/cache/consumer và UI; các write/read batches khác không đổi.48test mới semanticRED12fail→GREEN48, parent WT33file/518scoped+22policy/types/lint/build đạt (2warning cũ). Đo helper/normalization thật với DB boundary giả ở1k/10k/50k:4→2/34→12/167→56mapping SELECT, key/value hashes giữ nguyên/max900params; không phải tổng API SQL hoặc latency/throughput. Primary/review/runtime/integration gate ở mục34 và `docs/customer-node-mapping-batches.md`. Node0TB prefix index chưa làm; Task9/native/strictvisual/release còn mở, chưa publish.

**Checkpoint customer-map node projection, 29/10/2026:** Local opt-in `/api/nodes?projection=coordinates` gửi4field cho customer map; shared `nodes:list` luôn full, legacy/node-map/views/templates/auth/SQL/nearest/PUT giữ nguyên.33unit+12UI mới, semanticRED11fail→GREEN45; candidate32file/470scoped+22policy/types/lint/build đạt (2warning cũ).12browsercase cùng14node giả giảm node JSON3.312→1.268byte(-61,71%), legacy/customer/scoped-view hashes và48UI summaries/nearest/polyline khớp, không phải fullDOM/pixel hoặc latency claim. Size-only mapper1k/10k/50k giảm58,03–66,45%; không render50k/DB benchmark. Primary/review/integration gate ghi ở mục33 và `docs/customer-map-node-projection.md`. Chưa đóng Task9, strictvisual Node0TB/native/release hoặc publish.

**Priority:** P1 cho projection; P2 cho scale lớn. **Dependencies:** Task 1, 4, 7.

**Files:**
- Modify: `src/app/(dashboard)/map/MapComponent.tsx`, `src/app/(dashboard)/node-map/NodeMapComponent.tsx`, `src/app/(dashboard)/node-0tb/Node0TbMap.tsx`.
- Modify: `src/app/api/customers/map-data/route.ts`, `src/lib/customer-node-mapping.ts`, `src/lib/node-0tb-db.ts`.
- Create nếu cần: `src/app/api/nodes/map-data/route.ts`, `src/app/api/nodes/[id]/route.ts`, DTO trong `src/types/index.ts`.
- Test: `tests/integration/map-projection.test.ts`, `tests/e2e/maps-readonly.spec.ts`.

- [ ] Fixture/test FAIL cho marker/detail projection, missing coordinates, counts và exact/base/prefix matching.
- [ ] Đo payload từng API; marker DTO giữ ID/tên/tọa độ và đủ trạng thái để màu/filter/cluster đúng. Chi tiết khác tải khi chọn, không drop trường cần dùng.
- [x] Slice Node0TB: opt-in8field đủ cho toàn bộ map hiện tại, API legacy giữ đủ dữ liệu; không tạo per-marker request.26unit+11UI mới và số liệu/gate cụ thể ở mục32; strictvisual vẫn mở. Customer marker/general-node DTO và broader detail-loading còn pending.
- [x] Slice node bootstrap cho customer map: opt-in4field, full shared cache/legacy giữ nguyên, không đổi customer payload hoặc nearest/assignment.45test mới và browser/size-only metrics ở mục33; không thay thế full Task9/native/visual acceptance.
- [ ] Reuse/dedupe node data; giải quyết mapping bằng join hoặc batch cố định, không N mapping query theo số marker.
- [x] Slice bulk account→node read helper dùng900bindings/chunk thay300; không query mỗi marker hoặc đổi write pipeline. Counts1k/10k/50k ở mục34, vẫn ceil(unique/900) chứ không phải một query cố định; join/lookup rộng hơn chưa hoàn tất.
- [ ] Node0TB bỏ auto-seed hot path, tối ưu lookup chuẩn hóa; giữ đúng stats tổng và danh sách có tọa độ.
- [ ] Benchmark giả 1k/10k/50k staging. Chỉ thêm bbox/zoom/paging hoặc server clustering khi projection chưa đủ budget; không tự virtualize 138 item.
- [ ] Test pan/zoom/search/GPS-denied/manual pin/detail/filter và count “tổng/có tọa độ/trong khung”; tránh count/marker mất âm thầm.

**Acceptance:** Mục tiêu giảm ≥50% JSON marker trong trường hợp cắt đủ trường, so bằng cùng dataset; matching, cluster, nearest-node và tổng thống kê không đổi. Không tạo tọa độ giả.

### Task 10 — Derived report queries CDT/cước

**Owner bổ sung, 29/10/2026, mục42:** Bỏ thêm menu Nguy cơ rời mạng vì không dùng, sau hai mục Tồn CDT/Rời mạng ở mục40. Chỉ gỡ entry khỏi Sidebar desktop/mobile và icon import thừa; giữ route/API/dữ liệu và các chỉ tiêu KPI liên quan. Không tiếp tục ưu tiên tối ưu những màn hình đã bỏ menu nếu owner chưa yêu cầu bật lại. Đây không phải thu hồi quyền hoặc xóa backend.

**Checkpoint Cước CĐ latest-date, 29/10/2026, mục41:** Cache ngày global mới nhất30giây dưới prefix `cuoc-cd:report` đã được import/config invalidate, kể cả kết quả rỗng. Lookup sau auth/role/readiness/scope; explicit date bypass; response keys/TTL60giây, rows/filter/rounding và5SQL/params giữ nguyên. RED18 semantic fail/3pass→GREEN21/21 trên SQLite bộ nhớ. Metadata+response warm:1→0 report SELECT; khác role/meta warm/report miss:4→3; cold4/explicit3 giữ nguyên, không phải SQL toàn API/latency claim. Write sau fill không invalidation có thể chờ TTL còn lại; read đang chờ/concurrent write không có hard freshness bound. Không single-flight/distributed/snapshot guarantee. Chi tiết `docs/cuoc-cd-latest-date.md`, QA/tích hợp ở mục41; metadata/domain optimization còn lại và Task10/release chưa hoàn tất, không publish.

**Đổi phạm vi theo owner, 29/10/2026, mục 40:** Bỏ menu Tồn CDT/Rời mạng và hai shortcut Tồn CDT trong trang CDT, giữ nguyên module/URL/API/dữ liệu để không ảnh hưởng nghiệp vụ khác. Dừng lát cắt tối ưu COUNT CDT tồn đang dở, không tích hợp vào primary; candidate và RED/GREEN giữ private, worktree đã restore đúng preimage. Không tiếp tục ưu tiên tối ưu hai màn hình không dùng nếu chưa có yêu cầu bật lại. CDT thường/cước và các phần Task 10 khác chưa hoàn tất; không coi ẩn menu là xóa dữ liệu hoặc chặn truy cập.

**Priority:** P1. **Dependencies:** Task 1, 3–4, 7.

**Files:**
- Modify: `src/app/api/cdt/outstanding/report/route.ts`, `src/app/api/cuoc-cd/report/route.ts`, `src/app/api/cuoc/report/route.ts`.
- Modify có điều kiện: `src/lib/cdt-outstanding.ts`, migration index/normalized keys.
- Create: `tests/integration/cdt-outstanding-equivalence.test.ts`, `tests/integration/cuoc-cd-scope.test.ts`.

- [ ] Fixture đối soát account khác case/khoảng trắng, employee/secondary code, tháng biên và các trạng thái đã thu/chưa thu.
- [ ] Cache report metadata hợp lý; không query tháng/count/seed trước mọi cache hit.
- [ ] Dùng date range/index thay `substr` khi phù hợp; tái sử dụng totals để bỏ count query dư; tránh lặp derived CTE không cần thiết.
- [ ] Cước CĐ lọc scope trong SQL bằng identity mapping/EXISTS, không tải nguyên ngày rồi mới loại bằng JS.
- [ ] EXPLAIN và đối soát totals/paging/rounding cho cả ba role. Không thêm unique account/node name khi dữ liệu/semantics chưa cho phép.

**Acceptance:** Với metadata đã cache, mục tiêu CDT tồn miss còn 2 report queries thay vì tối đa 5; warm hit không scan metadata. Tổng và dữ liệu theo quyền khớp baseline.

### Task 11 — UI vận hành rõ, gọn và dễ bấm

**Checkpoint điều tra auth timeout,30/10/2026,mục57 — diagnostic only, chưa sửa lỗi:** Tạm dừng thêmUI để điều tra2failedgate56. Cùng selectionWT51file894test, privatebodytrace894PASS (import385.29ms/handler7.81ms) không tái hiện. LoaderV1invalid36suitefail;V2passnhưng originalsetup2lần; giữ riêng. V3preflight+worker originalsetup1+private1/5000ms/forks/isolate unchanged,894PASS,target315.56ms/root evaluator244.20ms,6nestedspans; observer effects/privateAPI/cumulativeCPU/ELU và normal-completion-only restore, không end-to-end/production/rootcause proof. Independent review đúng5toolhash chỉ APPROVE diagnostics. Public chỉ4docs, app/tests/config/deps nguyên; snapshot491/360source/172dirty/1587artifacts bảo toàn. **Không authfix, currentBatchScopedAcceptancePassedfalse/originalFailureRootCauseProvenfalse/releaseReadyfalse**; nguyên cả2log893pass1fail/894 và manifest56/historical50/51. Guide `docs/schema-auth-timeout-repro.md`, plan/mục57. Cần failingtrace đủ bằng chứng trước regression/sửa/freshuninstrumentedQA; không rerun tới xanh hoặc nới deadline/skip. Native/Node0TB/fullNext/3role/release còn mở, chưa publish.

**Checkpoint URL khách hàng,30/10/2026,mục56 — implementation local, acceptance pending:** Whitelist q/searchlegacy+6filters/page/limit, readygate và atomicrestore/debounce fencing; page chỉ optin1line, không CSS/API/auth/CRUD/SWRpolicy changes. CorrectedRED13fail37pass; noopreorderRED1fail51pass→GREEN52. WT/primary nativeChromeV2 mỗi root12/12scenario×11steps (realpage/hook/SWR, fake role/transport, khôngNextAppRouter/SSRhydration). **WT/primarybroad mỗi root893pass1fail/894, GETusers401 timeout5000ms**, policy22/types/lint0error3warning cũ đạt. Giữexit1/failure/rootunknown, không focused/reviewer/broadrerun/skip/deadline change thaygate. Source/docs local có scan/backups/guards9paths và pending disposition, không waive/release, chưa publish. Guide `docs/customer-url-state.md`, plan/mục56; ưu tiên điều tra authgate đang tái hiện. WholeTask11/URLview khác/Nextrealbrowser/native/Node0TB/release còn mở.

**Checkpoint phản hồi tải khách hàng, 30/10/2026, mục55:** RealSWR giữ previousdata nhưng loading cũ vẫntrue trên keymới, page bỏ qua error. Chỉ derive hasData/refreshing (kể cả7filterdebounce), giữ rows/cachedempty, status cảnh báo chưa khớp query, namedbusylist và initial/stale-error/retry không falseempty. Retry guard theo context/attempt không khóa filtermới; toànquery/debounce/CRUD/roles/CSS cũ nguyên, scopedretry44px. TDD22 RED21fail1pass→GREEN22; race RED1fail22pass→GREEN23. Chromev2 lộ24retryheightfail40.8px, candidatev2 sửa đúng2declarations; V4 chờ animation có sẵn, mỗi root96/96, không hydration/auth/device/zoom/CLS/speed claim. WT/primaryQA riêng50file842test+22policy/types/lint0error3warning cũ, review/scans/exactscope/guards8paths; v1candidate/review/QA và failures giữ nguyên. Guide `docs/customer-query-feedback.md`, plan/mục55. URLfilter/back-forward và historicalauth/native/Node0TB/Task10/Task11/release vẫn mở, chưa publish.

**Checkpoint phân trang khách hàng, 30/10/2026, mục54:** Baseline Chrome80mẫu cho thấy10lỗi tràn khung ở390/rootfont200%; hit-area44px và focus đã đạt, không thêm CSS trùng. Chỉ namednav/select/actions/typebutton và4mobileCSSdeclarations wrap/width/minwidth/flex; giữ visibletext/options/callbacks/disabledequality/controlledvalues và desktop≥769. Synthetic form64submit là defensive contract, caller thật nằm ngoài form. RTL RED5fail14pass→GREEN19/19; WT/primaryChrome mỗi root80/80, values80/desktopgeometry40 unchanged, không hydration/device/zoom/speed claim. WT và primary QA riêng49file819test+22policy/types/lint0error3warning cũ, review/scans/exact-scope/integration đúng8ownedfiles. Guide `docs/customer-pagination-controls.md`, plan và mục54; không aria-live vì SWRpreviousdata, refreshing badge/URLfilter còn mở. Original authfailure50/trace51/native/Node0TB/Task10/Task11/release vẫn riêng, chưa publish.

**Checkpoint customer header, 30/10/2026, mục53:** Đã probe thật normal390/rootfont200: namebox59.97px/firstglyph85.14px giao status5.98×38px, computedheadernowrap/name normalwrap. Chỉ7CSSdeclarations trong4mobile-headerrule: flexwrap/mainbasis12rem/nameanywhere/statusmax100-normalwrap-autoMargin; không JSX/font/color/padding/breakpoint/data/handlers/API/roles change. CSS TDD actualChrome192case4variant×3roleprops×6width×2theme+rootfont390/1440: before68name/44overlap/18statusfail→after0all; preservationRTL13/13before/after không giảRED. CanonicalDOM192/tablegeometry192 và18normalfont100mobilegeometry unchanged, nofullpage/device/E2E/zoom/speed claim. QA/review/integration mục53 và `docs/customer-header-layout.md`; historicalauth/native/Node0TB/Task11/release vẫn riêng, chưa publish.

**Checkpoint missing package/CTV, 30/10/2026, mục52:** Chỉ mobileJSX: price-only label Chưa có tên gói/bỏfake-name`---`,0đ vẫn giữ; CTVfallbackChưa có/titleChưa có mã CTV, conditional2inlinewrapprops chỉ khi missing. Fullprovided/rawvalues/actions/roles/phone-account hints/desktop/CSSfiles/helpers/prices/predicates/backend không đổi. RTL RED13fail10pass→GREEN23; browserV1lộ6clipping rootfont200%390, diagnosticnowrapbox69.97/range99.23→wrapRED1fail23pass. GREEN-V2test đòi xóa styleattr saiReactstyle=""; chỉ sửa expectedpropertyempty, giữ app; finalGREEN24. BrowserV2after96/96, rawdesktopDOM/geometry vàcompletecard unchanged, stylesheet hashes identical. QA/review/integration mục52 và `docs/customer-missing-metadata.md`; current-batch validation không đóng authtimeout50/trace51/native/release, chưa publish.

**Checkpoint điều tra gate auth, 30/10/2026, mục51:** Private timing trace tách route.load/handler trong đúng schema-auth-order test, không ghi sửa publictests/app/config/deps/assertion/mock/resetModules/timeout/pool. Focused61/61 (GETusers109.11ms import/1.60ms handler), một broad diagnostic46file/763test (262.09ms/3.40ms), V2stable-context focused61/61 (96.82ms/1.55ms),212events53invocations mỗi lượt; chưa tái hiện timeout5000ms, nguyên nhân chưa chứng minh. V2 capturetest/pid/sequence trướcawait tránh late attribution; logs/runner V1-V2 giữ riêng. Không dùng tracedPASS thay uninstrumented gate; original primary762/763 failure/pending manifest mục50 bất biến, primaryScopedAcceptancePassed/releaseReady vẫn false. Guide `docs/schema-auth-timeout-investigation.md`; chưa có auth fix, không publish hoặc đóng Task11/native/release.

**Checkpoint customer empty fields, 29–30/10/2026, mục50:** Chỉ guard2mobile strips theo truthiness cũ +rowhint/CSS mới: thiếuSĐT/account có thông báo tĩnh gọn thay bordered `---`, đủ dữ liệu giữ subtree/copy/URLs/options/roles/node/hit-area nguyên. Không trim/mutate/diễn giải whitespace/literalplaceholder hoặc sửa desktop/backend/CTV/KPI. RTL RED9fail/5pass→GREEN14; Chrome actual SSR/syntheticprops fakeADMIN64case6width×2theme×4variant+rootfont200%390/1440,48DOMcontractfail→0,24missingmobilecase gọn≥20px/trường; mobile390thiếucảhai giảm90.78px. V2canonical DOM chỉ map exported CSSmodule generated tokens (V1rawcomparison failhash), geometry vẫn strict; desktoptable vàcompletecard unchanged. QA/review/primary/tích hợp mục50 và `docs/customer-empty-fields.md`; missingCTV/package/Task11/native/release còn mở.

**Gate mục50 còn mở:** WT763test/22policy/types/lint đạt; primary762pass/1fail do GETusers auth timeout5000ms, policy/types/lint và Chrome64case đạt riêng. Diagnostic auth+UI75pass không thay QA đỏ, nguyên nhân chưa chứng minh; không sửa timeout/config/skip/rerun bộ rộng để ép xanh. UI source có local, docs/scope-check chỉ lưu bằng chứng, `primaryScopedAcceptancePassed:false`, `releaseReady:false`; chưa publish hay nghiệm thu toànbatch.

**Checkpoint CTV compact, 29/10/2026, mục49:** Chỉ2JSX attribute sites và CSS trong640media: account stats2×2 giữ đủ4nhãn/value/hint, region/search names và reset searchField basisauto khi toolbar column (trước wrapper380px/input44px, icon lệch). Không đổi font/line-height/data/request/filter/counts/guard hoặc KPIconfig/desktop. RTL RED2fail/8pass→GREEN10; Chrome actual initialSSR/CSS32case,6mobilecompaction/search/iconfail→0,26noncompact geometry exact. Mobile390 stats/search lên243.45px, wrapper giảm336px, loadingcontent lên579.45px; không phải loadedrow/API-speed claim. V5 theme/font trước layout, preimagebaseline; diagnostic giải thích V4transition, không nới ngưỡng/appchange. QA/review/primary/tích hợp ở mục49 và `docs/ctv-user-stats-compact.md`; chưa đóng toànTask11/native/release.

**Checkpoint customer mobile controls, 29/10/2026, mục48:** Native label44px cho checkbox16px, min44px phone/Zalo/copy/node/edit/delete và focus trong mobileCard;4nút typebutton, tên thao tác theo khách hàng. Callback/value/links/flags/node-disabled và ADMIN-only selection/delete giữ nguyên, desktop không sửa. Corrected RTL RED7fail/12pass→GREEN19; Chrome SSR36case3fake-role/5width/2theme/+rootfont200%:18mobilecase lỗi target/type/name,6labelfail→WTafter0fail;18desktopgeometry unchanged. Form safety là wrapper fixture, không claim production đang bọc form; native label probe không React hydration/auth E2E. QA/review/primary/tích hợp mục48 và `docs/customer-mobile-controls.md`, chưa đóng toànTask11/native/release.

**Checkpoint summary identity layout, 29/10/2026, mục47:** Chỉ2root scope classes và CSS scoped cho Tổng hợp KPI/KPI Quản lý: mã/tên/chức danh dài wrap đầy đủ trong ô/card, cột số căn phải/tabular; không sửa data/handlers/formula/widths/sticky/breakpoints/global palette hoặc các panel khác. RTL RED2fail/4pass→GREEN6; Chrome actual-component SSR/CSS fixture:20case5width×2theme×2panel +4root-font200% (không browserzoom), V5before24identity fail→WTafter24pass, không API/DB/Nextbuild/hydration. Setup loader errors giữ riêng, không coi là app RED. QA/review/primary/tích hợp ở mục47 và `docs/summary-identity-layout.md`; chưa đóng toàn Task11/native/performance/release.

**Checkpoint password visibility, 29/10/2026, mục46:** Login và3ô Đổi mật khẩu có nút hiện/ẩn riêng, default masked, tên Việt/aria-controls/pressed/typebutton, disabled đồng bộ. Khi JS submit handler chạy che lại (kể cả local validation), ref guard không cho toggle queued khi pending. Shared component chỉ forward input attrs, CSS riêng44px/padding/focus dùng theme tokens; giữ values/verbatim requests/validation/backend và busy/success/error contracts. RED22fail→GREEN22, QA/review/tích hợp ở mục46 và `docs/password-visibility.md`. Native-invalid submit có thể không gọi handler; không claim autofill/mobile/browser/pixel hoặc hoàn tất mixed checkbox/Task11/native/release.

**Checkpoint tool iframe feedback, 29/10/2026, mục45:** Thêm client wrapper riêng cho Phiếu thu/Excel/Sửa ảnh sau server access guard hiện có; title có dấu, status/busy khi chờ, cảnh báo sau15giây và tải lại thủ công kèm nhắc mất tệp/chỉnh sửa chưa lưu. Keyed attempts dọn timer/state và focus khung mới; giữ src/query/iframe CSS, không tự reload/probe hoặc sửa assets/quyền. Iframe load không xác nhận HTTP200/app-ready, error event không được bảo đảm. RED11fail/14pass; hai lỗi handler non-bubbling sửa bằng capture, timer0ms jsdom focus đã trace/flush đúng; final25/25. QA/review/tích hợp ở mục45 và `docs/tool-frame-feedback.md`; không tick toàn Task11/mobile/browser/native/release.

**Checkpoint change-password feedback, 29/10/2026, mục44:** Ref guard và disabled fields ngăn submit/change trùng trong lúc PUT chờ; giữ API/body verbatim/min6/confirm/server session policy. Chỉ contract HTTP200/JSON message hợp lệ mới clear fields/báo success; unknown/network/5xx/malformed response dùng copy kết quả chưa xác nhận, không khẳng định mutation chưa commit hay tự retry. Labels/autocomplete/alert-status/busy đầy đủ, methodPOST chỉ tránh native fallback GET URL, không tạo no-JS flow. Corrected RED19fail/4pass→GREEN23, status-contractRED2→finalGREEN25; QA/primary/integration ở mục44 và `docs/change-password-feedback.md`. Không đổi CSS/menus hoặc đóng iframe/Task11/native/release, chưa publish.

**Checkpoint login feedback, 29/10/2026, mục43:** Sửa client form để rejected signIn và response không xác nhận thành công không để loading kẹt/own push dashboard sai; ref guard chặn submit trùng, failure mở lại form, success giữ busy như cũ tới navigation. Thêm alert/busy/description/autocomplete attrs; giữ CSS, credentials verbatim, redirect:false và server auth/roles/session. RED13fail/1pass+3unhandled exceptions cũ→GREEN14/14, không suppress. Không request timeout hoặc route-commit/unmount guarantee, SDK tự redirect vẫn ngoài phạm vi. Chi tiết `docs/login-feedback.md`, QA/primary/integration ở mục43; không tick trọn Task11/iframe/hiện mật khẩu/mobile acceptance hoặc publish.

**Priority:** P1/P2 tùy mục. **Dependencies:** Baseline; data contracts của domain ổn định.

**Files:**
- Modify: `src/app/globals.css`, `src/components/Sidebar.module.css`, report `kpi.module.css`, `SummaryKpiPanelClean.tsx`, `ManagerSummaryKpiPanelClean.tsx`, các skeleton cần đồng bộ.
- Modify: `src/components/CustomerTableRefined.tsx`, CSS của nó, `src/app/(dashboard)/ctv/page.tsx`, `src/hooks/useCustomers.ts` và customer page.
- Modify: `src/app/login/page.tsx`, `src/app/(dashboard)/change-password/page.tsx`, `src/app/(dashboard)/tools/ToolPageFrameClean.tsx`.
- Create nếu cần: `src/app/(dashboard)/tools/ToolFrameClient.tsx`; test `tests/ui/report-layout.test.tsx`, `tests/ui/login-feedback.test.tsx`, `tests/e2e/mobile-layout.spec.ts`.

- [ ] Viết test cho chuỗi mã dài không lấn cột KH; dùng wrap/ellipsis + full text accessible, số dùng alignment/tabular-nums rõ ràng.
- [ ] Chuẩn hóa hit-area mobile 44×44 px ở tác vụ chính/icon/checkbox wrapper, không chỉ tăng kích thước hình vẽ; giữ bố cục desktop gọn.
- [ ] Skeleton reserve đúng stats/filter/table height; đo lại CLS CDT tồn/Rời mạng và không nhảy vị trí nút khi refresh.
- [x] Implementation local rút gọn phone/account rỗng thành explicit missing hints, giữ populated data/actions/desktop (mục50, synthetic-props SSR/RTL); primary scoped gate vẫn pending timeout, không real appE2E/release acceptance.
- [x] Implementation local placeholderCTV/package rõ nghĩa, không fake-name`---` khi chỉ có giá, giữ0đ/rawdata và missingCTVwrap khi phóng chữ (mục52). Không đổi nghiệp vụ hoặc đóng auth/fullbrowser/release gate.
- [ ] Metadata khác/real loaded/mobile/hydration/screen-reader acceptance còn riêng; không suy toàncard/app được nghiệm thu từ fixtureSSR.
- [x] Summary tài khoản CTV mobile compact2×2 giữ đủ4chỉ số/hints, đưa tìm kiếm và khối nội dung lên sớm; reset basis gây khoảng trống dọc (mục49). Không cần toggle/collapsible; loaded-row/browser-hydration acceptance còn riêng.
- [ ] URL hóa filter/page/view theo whitelist, browser back khôi phục context; cần regression riêng, không gộp với feedback55.
- [x] Implementation local URL khách hàng: whitelist/deep-link/reload/pop/settled history và ready/debounce fences (mục56), focused52/52; không đóng wholeURLview/Next/browser hoặc broadgate. **WT/primaryauth timeout còn đỏ, currentBatchScopedAcceptancePassedfalse/releaseReadyfalse**; không đánh dấu feature được nghiệm thu release.
- [x] Khách hàng local: giữ previous-data khi đổi key/refresh, refreshing strip cả debounce, lỗi có retry và không false-empty; guard retry theo context, không đổi query/cache/quyền (mục55). Chưa real app/hydration/CLS/URL/browser-back acceptance hoặc hoàn tất toàn Task11.
- [x] Phân trang khách hàng local: reflow khi chữ lớn, named navigation/select/actions và non-submit buttons; giữ props/options/callbacks/disabled/desktop (mục54). Không đồng nghĩa URLfilter/refreshing/real browser lifecycle hay toàn Task11 đã xong.
- [ ] Login lỗi mạng luôn thoát loading, live region/autocomplete/hiện mật khẩu phù hợp; công cụ iframe có loading/timeout/reload và tiếng Việt có dấu, giữ server access guard.
- [ ] Với map label/legend/bottom-sheet, tạo preview nhỏ và xin duyệt trước đổi trải nghiệm; không thay palette/toolbar toàn bộ trong cùng PR hiệu năng.
- [ ] Test 360/390/768/1024/1440, light/dark, zoom text/keyboard; không kết luận lỗi header overlap khi probe chưa xác nhận.

**Acceptance:** Không chữ lấn cột, không tràn ngang cấp page, thao tác chính dễ chạm, CLS lab mục tiêu ≤0,1. Quy tắc KPI zero-target/N/A cần business decision riêng, không tự đổi công thức.

### Task 12 — File/import/backup: subproject sau core load

**Priority:** P1 vận hành; phạm vi/chi phí phải duyệt riêng.

**Files:**
- Modify: `src/app/api/import/route.ts`, `src/app/api/nodes/upload/route.ts`, `src/lib/node-0tb-db.ts`, importer UI tương ứng.
- Modify: `src/app/api/official-documents/upload/route.ts`, `src/lib/official-doc-assets.ts`, `src/app/api/admin/backup/route.ts` (GET backup và POST restore dùng chung route này; không giả định có route restore riêng).
- Create theo thiết kế được duyệt: upload/export job service, job status API, storage adapter và `tests/integration/backup-restore-roundtrip.test.ts`.

- [ ] Trước tiên sửa thông báo/validation theo giới hạn thật của hosting; không chấp nhận file 20/200 MB rồi mới thất bại ở Function.
- [ ] Benchmark import row-wise với fixture giả; multi-row UPSERT/staging set-based publish, batch theo bind count/byte, retry idempotent.
- [ ] Nếu cần file lớn, trình bày lựa chọn storage/job + quyền truy cập/chi phí; chỉ triển khai sau owner approval.
- [ ] File upload/download lớn đi trực tiếp storage; API trả metadata/job status. Không giải quyết bằng tăng Next proxy body limit hoặc timeout.
- [ ] Backup dùng snapshot/read-consistency phù hợp; restore sang DB thử, kiểm checksum/foreign key rồi mới quyết định activation có rollback.
- [ ] Theo dõi progress, failure/retry/cancel và cleanup asset tạm; test tải lại trang không mất trạng thái job.

**Acceptance:** Không job/file lớn làm treo UI hay dồn cả backup vào RAM Function; không nửa snapshot sau import lỗi. Giữ local recovery/backup riêng, không đụng web cũ.

### Task 13 — CI, RUM và rollout từng đợt

**Checkpoint quality baseline,30/10/2026,mục58 — cleanup local đạt, auth rootcause chưa rõ:** Dùng metadata coordinator có sẵn, đọc sau test, không thêm worker setup/plugin/reporter/profiler: một WT control51file894PASS trước cleanup, GETusers503.34ms; URLfetchaggregate không per-case/fullimport/production latency, không rootproof. Giữ auth pending, không speculativefix. Chỉ capture markerregistry trong effect cho writes+ownercheckedcleanup, bỏ unusedskippedRows allocation và uncalledreadSheetObjectRows helper; giữ SheetRow/importcontracts/CRUD/UI/auth/tests/config/deps. Baselinegreen trước refactor; focused42/42, WT+primary mỗiroot894scoped+22policy/types đạt, **lint toànsrc0error/0warning với max-warnings0**, không disable/rulechange. Review3hash/exactscope/preimage/backup/defaultsecret/whitespace/hash-inventory/HEAD/index/oldBUILD_ID guards; chỉ3source+3docs,174dirty/1624artifacts cũ nguyên, chưa publish. Guide `docs/schema-auth-timeout-repro.md` follow-up58, mục58. **cleanupCurrentBatchScopedAcceptancePassedtrue khác authTimeoutRootCauseProvenfalse/original56ScopedAcceptanceClosedfalse/releaseReadyfalse**; NativeWindows/libSQL/KPI-timeout/Node0TBstrictvisual-timing/fullNext/3role/wholeTask13/release vẫn mở. Không dùng QA mới sửa lịch sử failedgate56/57.

**Files:**
- Modify: `.github/workflows/ci.yml`, `package.json`, tài liệu deploy/tiến độ.
- Create: `tests/e2e/critical-workflows.spec.ts`, `src/components/PerformanceVitals.tsx` hoặc instrumentation tương đương, `docs/performance-budgets.md`.
- Retain: `tests/ui/customer-workflow.test.tsx` và các test KPI/permission/import hiện có.

- [ ] Chốt Node CI/runtime tương thích, chạy unit/RTL + browser smoke thật trên DB giả; không chạy browser write suite vào Production.
- [ ] Performance regression job so request count, JS/payload budget và layout screenshots ổn định; không dùng timing single-run quá chặt làm CI flaky.
- [ ] RUM chỉ ghi route template/view/viewport/metrics không PII; không ghi query search, account, tên/SĐT/token. Chốt nơi lưu/retention/chi phí trước bật.
- [ ] So baseline trước/sau theo từng đợt; không tuyên bố “nhanh gấp X” khi chưa có số liệu cùng điều kiện.
- [ ] Staging smoke cả 3 role; owner duyệt rồi mới commit/push/deploy. Đổi config/region/migration có rollback/checklist riêng.
- [ ] Cập nhật `tiendokpi.md`: done/deferred/known limitations, metrics và commit/deploy thật, không tick việc chỉ mới đề xuất.

**Acceptance:** Mỗi release có bằng chứng tốc độ, độ đúng và quyền truy cập; phát hiện regression form native-browser như lỗi Node vừa sửa, không chỉ “unit test xanh”.

## 5. Commands/gates cho người thực hiện

Chạy từ `D:\code\webkpimoi`. Các command bên dưới là hướng dẫn triển khai sau phê duyệt, **không được chạy build hiện tại lên Production để thử plan**.

```text
npm.cmd test
npm.cmd test -- tests/ui/customer-workflow.test.tsx tests/ui/kpi-calculator.test.tsx tests/ui/summary-kpi.test.tsx
npx.cmd tsc --noEmit
npm.cmd run lint
git diff --check
```

Expected baseline hiện có: 37 file/127 test đạt, TypeScript đạt, lint 0 error/4 warning cũ. Khi thêm test, số lượng tăng; không ép về 127 bằng cách bỏ case.

Harness local đã có; set `PERF_USERNAME`/`PERF_PASSWORD` trong process riêng, chỉ trỏ preview dùng dữ liệu giả rồi chạy:

```text
npm.cmd run test:performance
npm.cmd run perf:baseline -- --scenario reports --samples 3
npm.cmd run perf:summarize
```

`test:performance` chạy policy tests của harness, không phải E2E ứng dụng. `test:e2e`, mobile/throttle flags và CI performance job **chưa được tạo**. Harness hiện đo desktop với route cố định, dùng Chrome cài sẵn qua `playwright-core`; xem `scripts/performance/README.md`. Build đã tách migration nhưng runtime vẫn có DDL/seed, nên Preview/CI tiếp tục phải có database riêng.

## 6. Backlog có điều kiện, không làm mặc định

- Username canonical/index và revocation scheme phải kiểm tra case collision trước backfill; không đổi username đăng nhập của người dùng tùy ý.
- Full viewport/server clustering chỉ khi DTO nhẹ chưa đạt budget ở workload tăng trưởng; không thêm virtualization cho bảng đã phân trang 10/20 dòng hoặc 138 Node0TB không có vấn đề render được đo.
- Shared cache service/object storage/job platform cần quyết định chi phí và vận hành riêng; không đổi stack toàn bộ vì chưa có trace.
- Upgrade Next/React/Prisma và audit dependency theo changelog/security: tách release, không gộp cùng sửa query/CSS; không khẳng định dependency hiện tại có lỗ hổng khi chưa verify advisory.
- Dark theme/contrast, tablet, điện thoại thật, slow-network/offline và iframe internals cần QA bổ sung; không coi 46 sample hiện có là kiểm thử đầy đủ.

## 7. Đề nghị bắt đầu

**Duyệt đợt 1 và quick win Task 5 trước.** Có baseline + hàng rào dữ liệu, sau đó loại request lặp và runtime setup. Khi số liệu load đã tốt hơn mới triển khai các thay đổi UI có preview. Tài liệu này không phải yêu cầu tự chạy toàn bộ tasks ngay.
