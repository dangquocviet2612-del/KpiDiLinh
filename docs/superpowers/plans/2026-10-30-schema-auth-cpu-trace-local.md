# Schema/auth timeout: bounded CPU and import diagnostics

> Use systematic-debugging and independent review. Continue failed68GETusers401 test, not a new UI feature. Local only; no real credentials/DB/network/import, branch/commit/push/deploy, application/public-test/config/dependency edits, timeout/pool/resetModules/mock/assertion changes, warmup or retry-until-green.

**Goal:** Try to obtain a failing trace that separates module loading/evaluation, worker CPU/wait and handler activity before proposing an auth fix. A diagnostic pass never replaces68failed gate.

**Frozen workload:** Exactly the65file/1276case selection recorded in68worktree-qa.json, on the same worktree and candidate hashes. Primary application remains67, candidate68stays in worktree. Preserve all previous artifacts and main/worktree divergence explicitly.

**Protocol, fixed before running:**

1. **A-coordinator:** existing startVitest invocation with envDir:false, original setup once, timeout5000/forks/isolate unchanged. Read built-in task/module diagnostics and metadata only after tests finish; no worker profiler, setup, reporter/plugin or evaluator patch. Current65file workload differs from historical58's51files; do not compare as same selection or use a pass as proof of stability.
2. **B-loader-cpu:** same selection/config plus exactly one ignored worktree-local private setup. Only in the schema-auth-order worker, preserve test body and wrap installed module evaluators with async ownership/parent/phase clocks; buffer records until afterAll. Start Node inspector CPU sampling at setup, stop afterAll; no worker stdout/body/credentials. Capture clock brackets, targetcase timing, CPU/ELU snapshots and pending spans at cleanup. Restore owned evaluator functions and disconnect sampler. Config-only preflight and runtime prove original setup1+private1, timeout5000/forks/isolate unchanged.

Exactly one A and one B, in that order. No extra focused/full-native/Next/browser run or repeats to get a desired outcome. A/B are diagnostics, not acceptance. If harness safety/config fails, preserve and stop rather than retrying a modified harness under the same labels. Process watchdog180seconds per cell; only the owned child PID/tree can be stopped. Record exit/signal honestly.

**Preflight V1 correction before any tests:** A config-only child wrote config.json; parent attempted the same filename for process metadata and failed EEXIST. Preserve V1 helper copies, preregistration, config and output; child exit was not recorded, no tests ran. V2 uses fresh v2/A and v2/B namespaces, config-process/run-process JSON names and setup-v2. Only output naming/namespace changes, not workload or timers. Re-freeze/review V2 before its config preflight/test cells; the two actual test-run budget is unchanged. No reusing V1 labels or overwriting failure evidence.

**Interpretation:** Built-in coordinator URL durations are aggregate fetch RPC timings, not per-case import/handler latency; don't add nested spans. CPU samples are inclusive stack observations, not exact wall time or proof of rootcause. Inspector start brackets introduce alignment uncertainty; use bounded windows and disclose it. A successful sampled run or idle-heavy sample alone cannot explain historical failures. No subtracting arbitrary sums or inferring scheduler/antivirus/native/DB causality without evidence. If no failing trace, rootcause stays unknown,68acceptance false, and no speculative auth fix/source integration.

**Files/public scope:** Create `docs/schema-auth-cpu-trace.md` and this plan; update roadmap and append69 in `tiendokpi.md`. No application/public test or config changes. Private scripts/profiles under ignored .local/performance and visualization staging only, no raw data sent elsewhere.

## Checklist
- [x] Snapshot both roots/all public files, source divergence68, prior artifacts, HEAD/index/oldBUILD_ID and scoped instructions.
- [x] Freeze protocol/selection/runtime/source/helper hashes, syntax/config/inspector smoke and independent harness review; preserve pre-run plan hash.
- [x] Run exactly A then B once; store actual results/metadata/profiles and runtime setup proof without overwriting68.
- [x] Analyze targetcase, sampler brackets/ownership/coverage and all failure outcomes; review conclusions, keep gate pending unless causal proof exists.
- [x] Default redacted docs secret scan, whitespace/preimage/backups/inventory and docs-only integration; append69 and report limitations.

## Remaining acceptance

Both fixedV2cells65file/1276PASS, targetA342.68ms/B320.54ms, retry0. No timeout reproduced; rootcause not proven and68gate/candidate status unchanged. B1worker/6inclusive spans restored, profile555samples and74.61ms start bracket; no exclusive handler/timing/causality inference. V1 output collision remained config-only, no test retry. Installed startVitest auto-closes before return; raw before-close label is an erratum, not live collection. Details/limits in `docs/schema-auth-cpu-trace.md`.

Pre-run independent harness review APPROVE_DIAGNOSTICS_ONLY exact4hash; post-run conclusions review APPROVE_DIAGNOSTICS_CONCLUSIONS_ONLY exact summarizer/summary hashes, no P1/P2 findings. Neither approves authfix/integration/acceptance; draft docs outside reviewer scope, checked against raw evidence before docs-only integration.

Actual auth fix requires a causal failing trace, a relevant RED regression and minimal reviewed fix, then fresh uninstrumented QA in both roots. This diagnostic plan does not authorize hiding the failed68gate or promoting candidate68. Native Windows/libSQL/KPI-timeout/Node0TB timing-image/Next/browser/three roles/whole Task12/CI-RUM/release remain separate.
