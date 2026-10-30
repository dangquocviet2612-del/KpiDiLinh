# Official-documents CSS isolation — rejected experiment, local 28/10/2026

> Use superpowers:subagent-driven-development with TDD and independent spec then quality review. Approved Task8 selective CSS continuation, local only, no commit/push/deploy.

**Goal:** Remove document-only CSS from personal/report initial assets while preserving exact UI, API and state behavior.

**Decision:** Hook extraction now risks resetting filters/drafts or introducing code→data waterfall. Keep all hooks/owners in place; isolate the exclusively official-docs stylesheet first. No visual redesign, no palette/text/layout/declaration changes.

**Architecture:** Move all rules owned solely by doc*/docs* class names from prepaid/kpi.module.css into prepaid/official-docs.module.css, including corresponding900px media rules. Shared panelState rules in that mixed media block stay in the shared file. OfficialDocsPanel imports docStyles only for moved class references, shared styles remain unchanged. Existing top-level lazy panel boundary/defaultSSR determines CSS loading; no bundler config/ssr:false/inline-style injection/preload-all.

**Cascade constraints:** Preserve selector specificity, declarations/important/order within domain and at-rule ancestry. The only overlapping local host is toolbar+docsToolbar; original shared toolbar/media rules precede docs rules, and no later shared toolbar rule was found. Verify this remains computed-style/pixel-equivalent across viewports. Keep shared classes/globals and no copying document rules back into eager sheets.

**Files:** Modify src/app/(dashboard)/prepaid/kpi.module.css and OfficialDocsPanel.tsx, create official-docs.module.css; create tests/unit/official-docs-css.test.ts. No hooks, calculator, JSX behavior, API/auth/cache/schema/dependencies or existing tests. Parent owns docs/harness; worker owns these four source/test files.

**Tests:** Semantic CSS ownership/at-rule/golden-rule signatures must fail on old combined CSS before application edits, not missing-import errors. Snapshot original canonical doc and remaining shared rules to prove lossless extraction. AST/mechanical class-prefix-only component diff, scan all callers. Installed PostCSS only, no added packages. Current19+1 UI files/assertions retained.

**Browser:** Measure decoded CSS separately from JS in34 same-fixture cold API/UI cases. Independent visual-only synthetic official-document response fixture (not used to fake API equivalence), read/detail/editor/image-URL modal at390/768/900/1024/1440 and light/dark: compare computed styles and stable screenshots. No business write, real credential/DB or external content requests. Retain6 calculator draft scenarios from prior slice.

- [x] Snapshot405 files/323 matching sources/65 primary changes and current built identity before editing.
- [x] Baseline CSS/JS/API/UI34cases and48 deterministic official-documents visual fixtures, no app edits to baseline build.
- [x] Genuine semantic RED7fail/1pass -> GREEN8/8, lossless CSS extraction/reference routing and focused tests/types/lint.
- [x] Freeze exact delta; spec PASS, quality REJECT integration because compiled CSS remained eager. No performance approval.
- [x] Full WT64files/823tests+22policy/types/lint/guarded fake build;48visual and6draft pass,34case browser runner exits1 at personal CSS164879 ->165001(+122).
- [x] Diagnose real compiled asset containing both docs and shared rules; archive exact candidate, restore only four owned files to verified preimage, stop candidate preview.
- [x] Verify retained primary: full suite FAILED native worker3221225477 at cache-invalidation.test.ts,801/815tests completed; no suite retry. Independent22policy/types/lint pass.323source bytes match; secret-scan and integrate documentation only, preserve65 prior changes, no publish.

**Safety:** Reuse detached WT D:/code/webkpimoi/.worktrees/ux-performance-batch1; primary D:/code/webkpimoi. Preserve65 prior changes, no reset/branch. Only fake batch6 SQLite and guarded synthetic env; keep native Windows gate open, no native retry/skip/pool/dependency workaround.

**Acceptance/limits:** Personal must not receive document-only stylesheet; verify actual compiled requests, not source split alone. Report measured decoded bytes, not latency/p95/transfer-compression claims. Reject CSS/cascade/UI/API/state regressions. If bundler still hoists or there is no real savings, report it, do not silently change global config/SSR to claim green. Hook/view ownership, further CSS domains/CLS/slow network and Task7 auth/native gaps remain separate.

**Outcome:** Candidate acceptance failed, so no application source/test integration. Source-only extraction did not defer CSS in this build. Guide docs/official-docs-css.md and progress section30 record the rejected experiment; Task8 remains partial. Candidate build is archived/stopped and no longer matches restored WT source; rebuild before reusing preview. Old helper integrate.cjs/finalize.cjs remain private and must not be used to accept this rejected candidate.

**Gate still open:** Full retained primary suite did not pass; independent static/policy checks and historical/candidate successes do not override the native crash. Completion of this experiment/checklist means a measured rejection and documentation checkpoint, not completion of Task8 or release acceptance.
