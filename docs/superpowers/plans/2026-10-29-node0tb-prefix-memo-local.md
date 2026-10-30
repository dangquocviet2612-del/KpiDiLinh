# Node0TB request-local prefix memo — Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development/TDD, spec then quality review. Existing Task9 lookup continuation, LOCAL ONLY. Reuse WT, preserve85 dirty primary paths. No branch/reset/commit/push/deploy, real env/DB, migration, dependency/native workaround.

**Goal:** Avoid repeated full node-map scans for Node0TB rows sharing the same normalized base code, without changing coordinate-selection semantics or UI.

**Architecture:** `getNode0TbList` builds the existing nodeMap from the same two reads. Keep per-row exact-code lookup first, exact-base second. Only prefix fallback consults a local Map keyed by the already-computed baseCode; `.has` distinguishes cached misses (`undefined`) from uncomputed keys. On a miss run the original insertion-order prefix scan and store its result while memo size<1000. Memo is created inside each getNode0TbList call, bounded to1000entries (hits and misses), no eviction/global cache/TTL/new async/SQL. At capacity uncached bases still use the old scan, preserving output. No normalization or match-policy change.

**Tech Stack:** Existing TypeScript/Next/Prisma/Vitest/Chrome, synthetic SQLite only.

## Decision / alternatives

- Chosen only if baseline operation counts confirm repeated scans on grouped-base synthetic inputs. Bench old/new actual service first:138small and1k/10k/50k rows, grouped fallback/exact-only/distinct misses. Capture uninstrumented3sample local service times as diagnostics, not cloud p95 or acceptance timing thresholds. Compare operation counts and full-response hashes separately.
- A trie/sorted prefix index changes data structures/ordering and adds complexity for the138-row product scale; defer until distinct-base CPU measurements justify it. This memo does NOT remove worst-case quadratic scans for uncached unique bases.
- Doing nothing is acceptable if grouped scans are not reduced or correctness/budget gates fail. Do not force a cache for a source-only claim. Per-request1000entry bound limits additional retention on50k-distinct input; no cross-request permission/invalidation scheme needed.

## Scope / six integration paths

1. Modify ONLY `src/lib/node-0tb-db.ts`: local typed memo declaration after nodeMap construction, plus wrap existing prefix fallback. Preserve exact/base lookup order for every row before checking memo. Descriptive tuple variable names allowed only inside this edited branch. No inline comments added, no exports/helper/API changes.
2. Create `tests/unit/node-0tb-prefix-memo.test.ts`: real getNode0TbList/import-utils with only Prisma/runtime-readiness boundaries mocked. No native imports or old assertions modified.
3. Parent docs: new `docs/node0tb-prefix-memo.md`, this plan at `docs/superpowers/plans/2026-10-29-node0tb-prefix-memo-local.md`, roadmap checkpoint and progress section35.

## Invariants

- Exact full-code match and exact-base match still beat any cached prefix result. Prefix result remains first matching Map entry for either-direction startsWith; normalized-name collisions keep last value at first insertion position. Keep zero/null coordinates, blank/Unicode/raw whitespace and SP-suffix semantics precisely as existing code.
- Same SELECT text/order/select fields/readiness/query counts, row order/all fields/date fallbacks, global stats/categories before filtering, category/search including nodeDescription and default/API projection unchanged.
- Memo hit/miss has no field mutation. Misses including empty nodeMap are memoized. Cap stores only first1000distinct fallback bases; later repeated uncached bases may rescan, output unchanged. A new/concurrent request never reuses another request's result, including after node coordinates/description change.
- No frontend/DTO/types/customer mapping/roles/auth/GET/DELETE/upload/template changes. Existing69+1=70test files/22UI files, all prior330source/config/test records except this service keep hashes. No claim existing ambiguous prefix policy is business-correct, only preservation.

## TDD and steps

- [x] Snapshot420files/330sources/85changes matched built Lv9R4uBtzz459gsJFzkZT. Separate known synthetic copy20rows/14coordinates/6missing after4SPsiblings; oldfixture unchanged. Plan review Mill APPROVE narrow local design, no source edits/native/visual waiver.
- [x] Actual old-service benchmark12datasets: grouped138/1k/10k/50k scan138/1000/10000/50000; grouped50kvisits49,387,500pairs, diagnostic3samplemedian647.665ms. Exact0scans/unique misses one scan perrow. Real-service Map.entries instrumentation separate from uninstrumented timing; no cloud/whole-page claim. Baseline24APIcases/12browsercases/72summaries complete, DBunchanged/no writes; ownedpreviewstopped before implementation.
- [x]39newtests semanticRED33fail/6pass→GREEN39, realservice/importutils/legacyoracle/narrowiterationobservations. PriorpreflightEPERMkeptseparate; nooldassertionschanged. Savedsource/log/checkpointverifiedafterworkerinterruption ratherthanassumingfinalcompletion.
- [x] Parentfreeze2hashes/reversalprovesonlydeclaration+prefixbranch edits, exact/base/restservice unchanged;70oldtests/22UI untouched. Fresh34file557scoped+22policy/fulltypes/lint0error2old/build pass/staticlogin/fakeDBhashstable, buildwTl7PY8ImRRqLXwfEOy2K.
- [x] SPEC Epicurus APPROVEsource/API, QUALITY Lorentz APPROVE_LOCAL_FUNCTIONAL_ONLY (uniqueTimingUncertainty OPEN/performanceacceptancepending). Capture Bernoulli APPROVEsymmetricsettledprotocolonly,notruntimepass. Source2hashesrestoredexactafterpreimagebaselinecapture; fresh557+22policy/types/lint/build/staticlogin/fakeDBunchanged, controlledbaselineHRvrslHnArml2ldyw99X-/candidateuHuPDrGeI3CACKtH0ZyOi. Old2lint/native801/815/strictvisual3PNG2geom remainOPEN/no skip/retry/pool/upgrade.
- [x] Actualservice12datasets fullJSONhashes equal/inputunchanged/same2reads+1readiness; grouped138→20/1k→100/10k→100/50k→100scans,exact0/uniqueRunchanged. Initialunique50ktiming614.184→1526.097ms anomalyRETAINED. Controlledsameprocess/no-prototype-hooks/noGCflags paired5samples unique417.133→423.051ms/grouped426.992→13.035ms. Notreproducedlargeunique slowdown, causeUNVERIFIED/nozero-overheadclaim; performanceacceptance/uniquetiminguncertainty remainOPEN. No app/source fix or matrixretrytoforcegreen; qualityLOCALdispositionpending.
- [x] V1FAILED67/72summarymatch,5GPStext mismatches/API24allmatch; exit1/source/error/PNG/buildpreservedincapture-v1. Samebuildmotioncontrolshows350msnotsettled, noCSSignoreclaim. ReviewedV2identicalsettleprotocolbothsidesviaoldservicepreimagebaseline+exactcandidate restore/freshQA/build. ControlledV2PASS24API/12browser/72fullsummaryequality,0writes/errors/fakeDBunchanged; rawtextassertionsnotremoved/no pixel/fullDOM/oldstrictvisualwaiver. Timingunique stillOPEN.
- [x] Preimage/hash/backup/whitespace/default secret scan passed;6paths integratedlocal/preserve85priorchanges. Initialscanner prose false-positive redactedrecords preserved, wording clarified/defaultscan0/noallowlist. Primary34files557scoped+22policy/types/lint0error2oldwarnings,331source/config/test byte-match builtWT/frozenhashes/fakeDBunchanged. Progress35 factual LOCALfunctional checkpoint only; uniqueTimingUncertainty/performance/native/oldstrictvisual/Task9/release stillOPEN, no commit/push/deploy.

## Test details

- Real-service fixture has exact-code win after cached positive fallback and independent exact-base precedence, colliding normalized names, earlier-first prefix versus longest-prefix, both prefix directions, duplicate bases differing case, suffix/trailing-space old behavior, zeros, null exclusions, no nodes/no rows/empty-code and Unicode/HTML-like strings. An existing exact base cannot naturally have a warmed fallback in a fixed nodeMap; do not manufacture mutable-map behavior. Frozen DB rows/nodes remain unchanged.
- Use independent legacy scan/oracle for returned full DTO/stats/category/search behavior; differential proof is equivalence, not a new matching correctness definition. Validate row output order and mapped descriptions separately from scan counters.
- Count real nodeMap iteration calls and visited pairs with narrow sentinel identity/shape guard; not mocking the matching result. Repeated misses must fail a get-only memo without has. Exact/base rows must never enumerate prefixes.
- Cap:1001distinct fallback bases then repeat first and last; cached first no rescan, uncached last rescans, new call resets budget/results. Sequential/concurrent requests with different node data cannot leak cached coordinates or misses. Error/readiness/no-write/query counts retained.

## Safety

Primary D:/code/webkpimoi main9d0365e (dirty); reused manual WT D:/code/webkpimoi/.worktrees/ux-performance-batch1 detached1ecfa38. Baseline is current dirty bytes, never old HEAD diff. Parent owns snapshot/fixture/build/browser/benchmark/docs/integration. Worker authors only2paths with apply_patch staging then approved copy. Both-root env guard, emptyTurso/dummyAuth/DBfake. No access to real env/SQLite/backups/cloud. Preserve former strict image failures and native gate rather than relabeling them PASS.
