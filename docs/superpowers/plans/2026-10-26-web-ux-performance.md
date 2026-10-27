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

---

## 1. Quyết định đề xuất

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
- [ ] Dùng shared query cho `/api/me` và session server hydration phù hợp; giữ khả năng refresh quyền ở server, không cache quyền vô thời hạn.
- [ ] Browser test nhanh đổi filter, retry lỗi và back navigation; giữ previous data nhưng có trạng thái “đang cập nhật”.

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
- Bound/LRU tối đa 1.000 entry và TTL/prune đã có test RED/GREEN; chưa có byte budget, single-flight hoặc generation chống stale refill. TTL không được coi là SLA quyền.
- [ ] Test với hai instance/process. Chọn shared version/invalidation nhẹ phù hợp; Redis hoặc dịch vụ trả phí chỉ là lựa chọn sau benchmark/duyệt chi phí.
- [ ] Chốt và test SLA revocation khi đổi role, manager, xóa user/đổi mật khẩu; không hy sinh bảo mật để giảm query.

**Acceptance:** Không stale dữ liệu/scope ngoài policy khi cache hit; cache không tăng không giới hạn theo key; hit/miss và invalidation quan sát được.

### Task 8 — Chia bundle report theo view, giữ shell ổn định

**Priority:** P1. **Dependencies:** Task 5.

**Files:**
- Modify: `src/app/(dashboard)/prepaid/PrepaidPageImpl.tsx`, `PrepaidPageClean.tsx`, `kpi.module.css` trong cùng thư mục.
- Create dần: `src/app/(dashboard)/prepaid/views/PersonalKpiView.tsx`, `SummaryKpiView.tsx`, `ManagerKpiView.tsx`, `CalculatorView.tsx`; thêm view container cho billing/CDT/docs theo nhóm riêng.
- Retain panel/hook hiện có trong mỗi view; tạo CSS module theo domain khi cần, không đổi mọi class trong một lượt.
- Test: `tests/ui/prepaid-view-loading.test.tsx`, browser bundle budget.

- [ ] Ghi bundle baseline, tìm module nặng thực tế; không quy server-only `xlsx` import thành client JS.
- [ ] Viết test FAIL đảm bảo mở personal không mount/fetch calculator/docs/CDT; skeleton giữ đúng layout.
- [ ] Router shell chọn `next/dynamic` view; chuyển hook/state của panel vào container của chính view, giữ filter/URL contract và scope.
- [ ] Tách CSS chọn lọc, preload theo intent nếu cần; test quyền và link trực tiếp từng `view=` hiện có.
- [ ] So lại network bytes, render và 10 view desktop/mobile; reject code splitting tạo waterfall dữ liệu mới.

**Acceptance:** Panel chưa mở không nằm trong entry tải ban đầu nếu không cần; mục tiêu thử giảm 15–25% JS giải nén phải được xác nhận, không ghi là kết quả trước đo. Không đổi API/công thức.

### Task 9 — Marker DTO nhẹ trước, viewport sau nếu cần

**Priority:** P1 cho projection; P2 cho scale lớn. **Dependencies:** Task 1, 4, 7.

**Files:**
- Modify: `src/app/(dashboard)/map/MapComponent.tsx`, `src/app/(dashboard)/node-map/NodeMapComponent.tsx`, `src/app/(dashboard)/node-0tb/Node0TbMap.tsx`.
- Modify: `src/app/api/customers/map-data/route.ts`, `src/lib/customer-node-mapping.ts`, `src/lib/node-0tb-db.ts`.
- Create nếu cần: `src/app/api/nodes/map-data/route.ts`, `src/app/api/nodes/[id]/route.ts`, DTO trong `src/types/index.ts`.
- Test: `tests/integration/map-projection.test.ts`, `tests/e2e/maps-readonly.spec.ts`.

- [ ] Fixture/test FAIL cho marker/detail projection, missing coordinates, counts và exact/base/prefix matching.
- [ ] Đo payload từng API; marker DTO giữ ID/tên/tọa độ và đủ trạng thái để màu/filter/cluster đúng. Chi tiết khác tải khi chọn, không drop trường cần dùng.
- [ ] Reuse/dedupe node data; giải quyết mapping bằng join hoặc batch cố định, không N mapping query theo số marker.
- [ ] Node0TB bỏ auto-seed hot path, tối ưu lookup chuẩn hóa; giữ đúng stats tổng và danh sách có tọa độ.
- [ ] Benchmark giả 1k/10k/50k staging. Chỉ thêm bbox/zoom/paging hoặc server clustering khi projection chưa đủ budget; không tự virtualize 138 item.
- [ ] Test pan/zoom/search/GPS-denied/manual pin/detail/filter và count “tổng/có tọa độ/trong khung”; tránh count/marker mất âm thầm.

**Acceptance:** Mục tiêu giảm ≥50% JSON marker trong trường hợp cắt đủ trường, so bằng cùng dataset; matching, cluster, nearest-node và tổng thống kê không đổi. Không tạo tọa độ giả.

### Task 10 — Derived report queries CDT/cước

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

**Priority:** P1/P2 tùy mục. **Dependencies:** Baseline; data contracts của domain ổn định.

**Files:**
- Modify: `src/app/globals.css`, `src/components/Sidebar.module.css`, report `kpi.module.css`, `SummaryKpiPanelClean.tsx`, `ManagerSummaryKpiPanelClean.tsx`, các skeleton cần đồng bộ.
- Modify: `src/components/CustomerTableRefined.tsx`, CSS của nó, `src/app/(dashboard)/ctv/page.tsx`, `src/hooks/useCustomers.ts` và customer page.
- Modify: `src/app/login/page.tsx`, `src/app/(dashboard)/change-password/page.tsx`, `src/app/(dashboard)/tools/ToolPageFrameClean.tsx`.
- Create nếu cần: `src/app/(dashboard)/tools/ToolFrameClient.tsx`; test `tests/ui/report-layout.test.tsx`, `tests/ui/login-feedback.test.tsx`, `tests/e2e/mobile-layout.spec.ts`.

- [ ] Viết test cho chuỗi mã dài không lấn cột KH; dùng wrap/ellipsis + full text accessible, số dùng alignment/tabular-nums rõ ràng.
- [ ] Chuẩn hóa hit-area mobile 44×44 px ở tác vụ chính/icon/checkbox wrapper, không chỉ tăng kích thước hình vẽ; giữ bố cục desktop gọn.
- [ ] Skeleton reserve đúng stats/filter/table height; đo lại CLS CDT tồn/Rời mạng và không nhảy vị trí nút khi refresh.
- [ ] Rút gọn khối `---`/account rỗng trên card; summary CTV mobile compact/collapsible, đưa tìm kiếm/danh sách lên sớm.
- [ ] URL hóa filter/page/view theo whitelist, browser back khôi phục context; previous-data có refreshing badge, không xóa dữ liệu đang xem mỗi lần request.
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
