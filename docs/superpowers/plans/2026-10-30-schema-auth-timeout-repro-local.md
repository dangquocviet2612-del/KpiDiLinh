# Schema auth timeout re-investigation plan

> Continue the observed GETusers gate from56, not another UI feature. Local only; no branch/commit/push/deploy/realenv/auth/DB/fullnative or deadline/pool/config/dependency/mock/assertion/resetModules changes to force green.

**Goal:** Xác định timeout nằm ở import/handler/scheduling từ failing trace trước khi sửa; không diễn giải diagnostic pass thành acceptance.

**Architecture:** Hai diagnostics private: Vite pre-transform đúng5unique markers trong test61case hiện có để tách import/handler; loader profiler giữ nguyên thân test, thêm private setup và instrument evaluator chỉ targetcase, buffer tới afterAll. Giữ stable invocation/async ownership/parent, processCPU/ELU và read-only module map snapshot; không bật experimental import-duration option. Đây không phải uninstrumented baseline; observer effect/privateAPI/normal-completion-only restoration còn hạn chế.

**Tech Stack:** Existing Vitest/Vite/React test selection51file894case, mockDB/auth có sẵn, envDir:false/env-file guard. Private logs chỉ tên test/path/module/timing, không requestbody/token/khách hàng thật.

## Checklist

- [x] Đối chiếu source/import graph, two recent failedgates và tracer51; giữ snapshot/oldartifact/pending false.
- [x] Một broad instrumented diagnostic cùng selection56 trênWT, không warmup/focused:894/894,395events, GETusers import385.29ms/handler7.81ms, không tái hiện. Giữ log/JSON/state; snapshotinternal selfTime có10module nhưng totalTime là field publickhác internalduration, không dùng trường thiếu làm số tổng hoặc gán rootcause.
- [x] Loader-profiler không transform public test body, buffer tới afterAll. V1cross-drive /@fs setup không resolve36jsdomsuite:325testpass/36suitefail; workload invalid, giữ riêng. V2copy cùngsetup vào ignoredWT/.local:894PASS nhưng duplicate originalsetup, không exact-baseline/acceptance.
- [x] Phân tích stablepid/sequence/phase, firstcase/cleanup/module timings. Các validdiagnostics không tái hiện; rootunknown, không speculative appfix. SnapshottotalTime thiếu không phải0; nestedwall không additive, CPUprocesswide/ELU không chứng minh nguyên nhân.
- [x] GiữV1/V2 và config-only evidence. V3chỉappend private setup; preflight vàworker đều original1+private1,5000/forks/isolate unchanged.51file894PASS, target315.56ms, root evaluator244.20ms/6nestedspans; không fullimport/handler decomposition ởV3, không Next/production performance claim. Review độc lập đúng5finalhash APPROVE diagnostics-only, không authfix/gateclosure.
- [ ] Chỉ khi rootcause đủ rõ: viết RED regression, sửa tối thiểu đúng đường lỗi, review rồi fresh uninstrumented WT/primary QA. Không bỏ import khỏi budget chỉ để né assertion timeout.
- [x] Guide/mục57/roadmap ghi measured/notproven/remaininggate; chỉ4docs public, snapshot/preimage/backup/scan/hash-inventory guards. Không appfix hoặc đóng56; bản tổng hợpV3 là diagnostic-summary-final.json, giữ bản phân tíchV2 cũ.

## Disposition

**Diagnostic completed; auth-fix/acceptance pending.** Không tái hiện timeout trong các validdiagnostics nên không sửa application code/test/config/deps. Cả2failedgate56 vẫn đỏ (893/894), manifest/logs không đổi; currentBatchScopedAcceptancePassedfalse/originalFailureRootCauseProvenfalse/releaseReadyfalse. Không dùng894PASSinstrumented thay gate56, không thêm UI để lờ lỗi, không rerun vô hạn. Bước tiếp theo là thu failing trace đủ bằng chứng rồi mới sửa và fresh uninstrumented QA. Native Windows/Node0TB/fullNext/staging3role/release vẫn mở; chưa commit/push/deploy.

Chi tiết `D:/code/webkpimoi/docs/schema-auth-timeout-repro.md:1`; mục57 của `D:/code/webkpimoi/tiendokpi.md`. Evidence private `.local/performance/schema-auth-timeout-repro-20261030/`.
