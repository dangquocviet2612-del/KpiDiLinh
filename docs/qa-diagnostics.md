# Lệnh QA ghi chẩn đoán — checkpoint 70

## Mục đích và phạm vi

Lệnh **opt-in**, chạy local cho lập trình viên: lưu metadata đã lọc khi chính lượt test đó thất bại, không cần chạy lại suite chỉ để lấy báo cáo. Không thay `npm test`, CI, auth, application code, test cũ, cấu hình Vitest, dependencies hoặc timeout/pool/retry. Không tự gửi báo cáo lên dịch vụ nào.

**Trạng thái:** công cụ riêng, không phải bản sửa timeout auth. Candidate 68 vẫn chỉ ở worktree; source app trong repo chính giữ mục 67. Failed gate 68 và các nghiệm thu native/browser/Node0TB/release chưa được đóng bởi checkpoint này.

## Cách dùng

Chạy từ checkout cần kiểm tra; script tự xác định repository theo vị trí của chính nó. Cần dependencies và Git đã có sẵn, `.local/` phải được gitignore. Chọn **test unit/UI đã review và không truy cập dịch vụ thật** trước khi chạy.

```powershell
node scripts/testing/qa-diagnostics.mjs --help
node scripts/testing/qa-diagnostics.mjs --output qa-local-01 tests/unit/user-validation.test.ts
$LASTEXITCODE
```

Ví dụ thứ hai là cách dùng cho lần QA sau, **không phải một lượt app test đã chạy trong checkpoint 70**. Đọc `$LASTEXITCODE` ngay sau lệnh; không dùng lệnh khác hoặc pipeline để che mã lỗi. Không đưa tên khách hàng, token hay dữ liệu nghiệp vụ vào nhãn output.

- Bắt buộc `--output LABEL` và 1–50 filter dưới `tests/unit` hoặc `tests/ui`; nhận cả đường dẫn Windows.
- Nhãn dài tối đa 64 ký tự: chữ/số đầu tiên, sau đó chữ/số/`._-`. Không nhận traversal, đường dẫn tuyệt đối, integration suite hoặc option sửa timeout/pool/retry.
- Filter được chuyển nguyên sang Vitest: đây là bộ lọc đường dẫn của Vitest, **không phải** bằng chứng rằng test bên trong an toàn. Đọc lại danh sách test trước khi chọn cả thư mục.
- Chỉ một child process và một lần `startVitest`; không tự retry hoặc mở lượt thứ hai. Lần gọi sau muốn giữ thêm bằng chứng phải dùng nhãn mới, không xóa/ghi đè báo cáo cũ.

Đầu ra riêng biệt:

```text
.local/performance/qa-diagnostics/qa-local-01.json
.local/performance/qa-diagnostics/qa-local-01-process.json
```

Hai đường dẫn phải là JSON gitignored/untracked dưới `.local/performance`, không symlink/hardlink hoặc file đặc biệt. Kiểm tra lại trước khi ghi, dùng exclusive-create; có sẵn một trong hai file thì từ chối **trước khi chạy test**. Không commit các báo cáo này.

## Dữ liệu được lưu

| Nhóm | Trường/ý nghĩa |
|---|---|
| Runtime | Schema version, Node/Vitest version đã lọc, mã thoát trước xử lý báo cáo |
| Project | Timeout số, pool enum, isolate boolean, retry số/null, số setup files; không lưu đường dẫn setup/project name |
| Tổng hợp | Số module, case quan sát, case thất bại, SDK failed tasks, module thất bại và unhandled errors |
| Case | Số thứ tự, đường dẫn module tương đối trong unit/UI hoặc `[redacted]`, outcome, duration/start time/retry count số/null, dấu hiệu thông báo timeout |
| Target cố định | Chỉ đúng case GET users unauthenticated đã biết nhận nhãn `users-get-unauthenticated`; không lưu fullName |
| Module fetch | Chỉ count/min/max cho bốn nhãn cố định users-route/user-validation/next-server/zod, nếu SDK có metadata; có thể rỗng |
| Process riêng | Mã thoát child, signal enum, spawnFailed, reportPresent, noRetryPerformed |

Không lưu arbitrary test title/error/stack/actual/expected, stdout, ENV, credential, request/response, URL đầy đủ hay absolute root. Đây là **allowlist metadata**, không phải thuật toán che thông tin nhạy cảm của mọi log. Tên file test tương đối vẫn hiện trong báo cáo; không đặt dữ liệu cá nhân vào tên file. Vitest console giữ nguyên và có thể in test title/error; công cụ không lưu/redact console, không tự động xuất reporter JSON đầy đủ.

`summary.failedTests` đếm các case có state `failed`. `summary.sdkFailedTasks` giữ riêng counter SDK: installed Vitest 5.0.1 đếm cả task module/suite thất bại trong `idMap`, **không được gọi counter đó là số test case thất bại**. Không cộng hai trường với nhau. Giá trị SDK không cung cấp được biểu diễn null/không có, không bịa thành 0; maxWorkers null không chứng minh số worker thực tế.

Giới hạn lưu 5.000 case, graph depth 64/20.000 visited nodes, JSON 2 MiB. Pending/unknown/malformed graph, không có case hoặc vượt giới hạn làm capture không hoàn chỉnh và exit thất bại. Đây là giới hạn bộ ghi, không thay giới hạn của test runner.

## Giữ nguyên thất bại và giới hạn ghi báo cáo

- Một case/module/SDK task/unhandled error thất bại hoặc capture không hoàn chỉnh không được trả exit 0, kể cả counter khác báo 0.
- Runtime đã có mã lỗi hợp lệ 1–255 thì giữ nguyên, kể cả lỗi capture/close. Signal/native exit ngoài dải vẫn trả mã lỗi, không chuyển thành thành công; process report giữ numeric child exit nếu có.
- Lỗi khởi động/capture/close được báo bằng marker cố định, không ghi raw exception. Lỗi ghi report vẫn làm lệnh thất bại.
- Parent không sửa main report: ghi process JSON riêng. Nếu child bị kill/native crash trước khi SDK return, **main JSON có thể không có**; process JSON ghi `reportPresent:false`. Nếu parent cũng bị kill hoặc disk/output lỗi thì cả process JSON cũng không được bảo đảm.
- Không thêm watchdog, timeout, profiler, custom reporter/plugin hoặc private setup file. Metadata lấy sau `startVitest` trả về; installed SDK đã auto-close trước return, lần close bổ sung là idempotent. Không có live worker/import/CPU trace hoặc lỗi gốc đầy đủ.

Module RPC durations là aggregate, không gắn từng case, không đủ để gán thời gian handler/import/DB hoặc chứng minh rootcause. Dấu hiệu timeout dựa vào message chuẩn, không phải chứng minh mọi timeout đều được nhận dạng. Không dùng một lần diagnostic pass để thay failed acceptance gate trước đó.

## Môi trường tổng hợp, không phải sandbox

Parent tạo child với `DATABASE_URL=file::memory:`, Turso URL/token rỗng, auth secret tổng hợp, auth URL localhost, NODE_ENV test và tắt telemetry. `NODE_OPTIONS` của child được thay bằng preload env guard, không kế thừa preload tùy ý của shell; các ENV khác như PATH được giữ. Không ghi các giá trị ENV vào JSON.

`qa-env-guard.cjs` chặn đường dẫn `.env`, `.env.local`, `.env.test[.local]`, `.env.development[.local]`, `.env.production[.local]` tại repository root qua các API stat/lstat/readFile/open sync, callback và promises thông dụng; đồng bộ builtin ESM exports. Vite dùng `envDir:false`. Không load env thật trong các lượt kiểm chứng checkpoint này.

Guard **không phải filesystem/network sandbox**: không chặn file tùy ý, alternate paths/env loader, credential khác, global setup hoặc test cố ý mở network/DB. Không chạy test chưa review, integration/write suite, restore/import hoặc login thật bằng lệnh này. Synthetic ENV không chứng minh rằng mọi cấu hình/database driver đều tự an toàn.

## Kiểm chứng checkpoint 70

Self-test dùng Node built-in, không cần chạy lại app suite:

```powershell
node --test scripts/testing/qa-diagnostics.test.mjs
node --test scripts/performance/read-only-policy.test.mjs
node --check scripts/testing/qa-diagnostics.mjs
node --check scripts/testing/qa-env-guard.cjs
```

- Test-first ban đầu: 40 case, RED 27 fail/13 pass do công cụ chưa có → GREEN 40. Bổ sung bốn regression cho counter bất nhất và giữ runtime exit khi start/capture/close lỗi: RED 4 fail/40 pass → GREEN 44.
- Fixture Vitest thật V1: hai case, một pass/một fail cố ý, child exit 1 và main JSON đã lưu; assertion harness phát hiện SDK counter là 2, không phải 1. Giữ nguyên raw V1, không đổi nhãn thành pass.
- Đọc installed SDK `getCountOfFailedTests`: đếm failed tasks trong `idMap`. Hai regression mới RED 2 fail/44 pass → GREEN 46; tách case count/SDK task count và giữ fail-closed.
- Điều chỉnh kế hoạch kiểm chứng vì source đã thay đổi: preregister **đúng một fixture V2** sau sửa; vẫn hai case/1 fail cố ý, exit 1, case count 1/SDK task count 2, JSON không có title/absolute root. Đây là retest sau fix của công cụ, không rerun unchanged candidate hay bộ app/auth. Không cộng hai fixture thành các case nghiệm thu sản phẩm.
- Lint ban đầu bắt bốn tên biến `module` theo rule có sẵn; đổi thành `testModule`, không disable rule. V3 worktree: 46 self-tests + 22 policy tests, syntax/help/types/lint đều đạt, lint 0 warning.
- Spec review phát hiện `diagnostic()` có thể undefined cho skipped/hook-blocked case, đối chiếu installed SDK rồi thêm hai regression RED 2 fail/46 pass; dùng null-safe reads, không bịa timing 0 hoặc mất toàn bộ outcomes. V4 worktree và **repo chính mỗi nơi fresh 48 self-tests + 22 policy**, syntax/help/types/lint đều đạt, 0 warning. Không chạy thêm fixture thật sau thay đổi null-safe; hai regression kiểm riêng thay đổi này.
- Independent SPEC rồi QUALITY **APPROVE đúng ba source/test hashes** bản cuối; không phải approval cho authfix, docs, private harness, gate68 hoặc release. Ba source công cụ được quét bí mật trước copy, primary QA riêng sau copy, bốn docs được quét/kiểm whitespace và giữ preimage/backup trước integration. Final manifest kiểm toàn snapshot, hai delta68, HEAD/index/oldBUILD_ID và artifacts cũ; `tiendokpi.md` chỉ append70.
- Fixture riêng mới dùng `configFile:false`, globals và node environment để không nạp app config; các override này **không có trong lệnh công cụ**. Không thay timeout/pool/retry/setup của app. Fixture default retry chưa xuất ở project là null, case retryCount là 0.

Evidence private: `.local/performance/qa-diagnostics-runner-20261030/` giữ snapshot/preimages, RED/GREEN, SDK regression, V1/V2 fixture và process/preregistration, QA từng root, review/hash, secret scan, backups và integration/pending manifests. Không đưa log/token/DB/dữ liệu nghiệp vụ vào Git.

## Còn mở

Timeout GET users cũ chưa tái hiện/fix, gate 68 chưa đạt/source chưa promote. Full native Windows/libSQL, KPI timeout, Node0TB strict visual/timing, Next build/browser/ba role, backup roundtrip/storage/jobs, RUM/CI/rollout/release vẫn tách riêng. Không đo được cải thiện tốc độ web từ việc thêm lệnh này, không commit/push/deploy.
