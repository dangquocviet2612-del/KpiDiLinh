# Điều tra timeout test auth — chưa tái hiện

## Kết luận hiện tại, 30/10/2026

Tiếp gate mục50: `tests/unit/schema-auth-order.test.ts`, case `GET users returns 401 without schema or database access`, timeout5000ms trong primary scoped QA (762pass/1fail). **Chưa chứng minh nguyên nhân và chưa có bản sửa auth.** Các lượt có trace dưới đây không tái hiện timeout; không thay original failed gate bằng một lần xanh có instrumentation.

`primaryScopedAcceptancePassed:false`, `releaseReady:false`. Lỗi này chưa được xác nhận là bug API trên web, cũng chưa được xác nhận do máy chậm/flaky/cold import/scheduling. Native/libsql/KPI-timeout/Node0TB visual-timing và các gate cũ vẫn riêng, chưa đóng.

## Đã kiểm tra và đo gì

- Đối chiếu `invoke`: `route.load()` nằm trong test body trước handler. `beforeEach` resetModules/resetAllMocks rồi cấu hình auth/prisma/schema/cache mocks; assertions kiểm401/no schema/no database sau invoke. Vì vậy test budget bao gồm nạp module, không chỉ handler.
- Đọc users route/import graph và cấu hình test hiện có: không tìm thấy bằng chứng từ source đủ để quy timeout cho một dependency hay handler cụ thể. Không chuyển import sang hook, prewarm module, đổi mock/assertion/resetModules hoặc tăng timeout/pool để né lỗi.
- Private Vite pre-transform chỉ đúng test file và2marker đã kiểm unique: quanh route.load và quanh handler promise. Mỗi invocation ghi import:start/end, handler:start/end bằng performance.now/stdout; không request body, session, token hoặc dữ liệu người dùng.
- Không ghi sửa test/app trên đĩa. Installed Vitest với project config cũ, envDir:false/env-file guard và configuration giả; auth/database đều mocks có sẵn, không web/server/real DB/accounts/env/Next build.

| Lượt diagnostic | Selection | GETusers import | GETusers handler | Trace |
| --- | --- | --- | --- | --- |
| V1focused | 1file/61test đạt | 109.11ms | 1.60ms | 212events/53invocations |
| V1broad | 46file/763test đạt | 262.09ms | 3.40ms | 212events/53invocations |
| V2stable-context focused | 1file/61test đạt | 96.82ms | 1.55ms | 212events/53invocations |

Một broad run có trace được thực hiện để quan sát cùng selection của lượt lỗi, không rerun bộ rộng liên tiếp để lấy xanh. Không cộng test qua các lượt:61case auth nằm trong763, không phải885case khác nhau. Các số đo là process-level test giả lập, **không phải latency API/web hoặc Production speed**. Instrumentation/logging có observer effect; không thể dùng một lượt không tái hiện để giải thích ngược lần timeout cũ.

V1 dùng currentTestName tại từng event; recorded runs không có overlap/late event, mọi group4events cùng identity. V2 chốt tên test/path/method/pid/sequence **trước await đầu tiên** để nếu kết quả về muộn, event vẫn gắn invocation ban đầu. Giữ cả V1/V2 runner và mọi logs thay vì ghi đè. Scope checker đối chiếu212events/53group, phase order/identity/time monotonic; V2 sequence1–53. Đây là consistency check của các run đã ghi, không phải bằng chứng đã tái hiện nhánh timeout/throw hoặc đã kiểm mọi trường hợp instrumentation.

Tracing dùng `.finally` cho contract Promise hiện có, không catch-convert lỗi; stdout/logging có thể tự lỗi và synchronous throw trước khi trả Promise sẽ thiếu endevent. Không dùng tracer làm wrapper production hoặc suy settlement/timing hoàn toàn tương đương. Env-file guard chỉ chặn các đường dẫn đã biết, không phải sandbox bảo mật tổng quát; metadata không thay audit mọi side effect của toàn selection.

## Bằng chứng được giữ

Local ignored `.local/performance/schema-auth-trace-20261030/` lưu starting-files/preimages, các trace raw log/JSON/state, trace-runner-v1/v2, driver, trace-summary và review/final-scope report. Instrumentation là công cụ private local, **không thêm vào runtime/CI hoặc public scripts của repo**, không tự chạy nền.

Original `.local/performance/customer-empty-fields-20261029/primary-scoped-tests.log`, `primary-qa.json`, `pending-acceptance.json` giữ nguyên byte/hash. App/public tests/fixtures/project configs/dependencies không đổi trong mục51. Không rerun policy/types/lint để giả có bản sửa application; syntax private runners đã check và chạy focused/broad theo bảng trên.

## Khi tái hiện mới sửa ở đâu

1. Giữ snapshot/hash/source identity, original failure, workload/selection/config cùng run; dùng label/evidence mới, không ghi đè log hoặc tái sử dụng manifest làm baseline khác source.
2. Chạy **một lượt có mục đích** bằng guarded private runner để thu spans. Driver lưu raw log/JSON cả khi fail; không dùng summarize của3run đã ghi như một parser nhận mọi failure mới. Không chạy lại đến khi xanh.
3. Ghép events theo pid/sequence/tên test đã capture, kể cả invocation thiếu end/late end. Timeout trong import, handler, trước invocation hoặc event-loop scheduling là các khả năng khác nhau. Không có end không đủ để kết luận pending vĩnh viễn: worker có thể đã dừng.
4. Nếu import dài, trace resolve/transform/evaluate trong cùng failing run; nếu handler dài, trace await cụ thể/auth/readiness mocks. Thu event-loop/resource timings trước quy lỗi CPU/memory/worker contention; không coi worker-startup số cao của log cũ là causal proof.
5. Chỉ khi xác định nguyên nhân: viết repro/regression, sửa tối thiểu, review và chạy uninstrumented primary acceptance riêng. Không xóa test, suppress exception, tăng deadline, thay pool/config/deps hoặc move import ra khỏi assertion budget để ép xanh.

Review static độc lập APPROVE đúng2hash runner/driver, xác nhận phạm vi instrumentation và kết luận giới hạn; không thay test acceptance hoặc parent scope/scans. Đợt này chỉ4tài liệu public: guide này, plan `2026-10-30-schema-auth-trace-local.md`, roadmap và append51 `tiendokpi.md`. Scope-only guards đối chiếu469snapshot paths/148dirty/1088artifact cũ, backup/whitespace/default secret scan; mọi app/publictest/fixture/config và original gate bất biến. Không branch/commit/push/deploy hoặc đổi3menu đã ẩn. Giữ gate pending thay vì phát hành dựa trên trace xanh.
