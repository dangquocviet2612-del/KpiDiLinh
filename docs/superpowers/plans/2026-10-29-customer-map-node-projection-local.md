# Customer-map node coordinates projection — local 28–29/10/2026

> Approved Task9 continuation, local only. Use subagent-driven-development/TDD/spec and quality review. Preserve75 prior changes, no commit/push/deploy, real env/DB access or dependency changes. Reuse existing detached WT.

**Goal:** Reduce node bootstrap JSON used by customer map without changing customer payload, nearest-node logic, UI or other /api/nodes consumers.

**Design:** Exact opt-in GET /api/nodes?projection=coordinates on DEFAULT LIST branch only. Response {data:[{id,name,latitude,longitude}]} retains all values/order/rows including zero/null as originally returned; no filtering/coercion/normalization. New pure projectNodeCoordinates helper with explicit allowlist and NodeCoordinateItem/NodeCoordinatesResponse types. Keep existing models byte-prefix intact.

**Cache invariant:** nodes:list ALWAYS stores full legacy payload, same key/TTL/generation capture/fourth setter arg and invalidation. Project only at response time for both hit/miss, never mutate or store projected data. Coordinate-first -> legacy hit and legacy-first -> coordinate hit must work. No separate projection cache, query, readiness work, async step or per-node request. No SQL/backend-latency claim.

**Precedence:** Auth first as before; downloadTemplate and view=account-node-mappings/node-accounts remain unmodified and ignore projection. Their permission, scope, paging, binary content/headers and errors must remain unchanged. Unknown/empty/case variants use full legacy default. Default node list read access remains as existing for3roles, no scope tightening/bypass.

**Frontend:** Only import type NodeCoordinateItem, replace nodes useState<any[]> with typed array, and node URL. No other customer-map JSX/styles/state/effects/search/distance/tie/assignment/modal/save/GPS/handlers changes. Original node map MUST still call full /api/nodes because popup/filter/CSV use metadata. Customer API and search APIs untouched.

**Six worker files:**
- Modify src/types/index.ts (append interfaces).
- Create src/lib/node-coordinates.ts (pure mapper).
- Modify src/app/api/nodes/route.ts (two list response sites, full cache invariant).
- Modify src/app/(dashboard)/map/MapComponent.tsx (type+URL only).
- Create tests/unit/node-coordinates-projection.test.ts.
- Create tests/ui/customer-map-node-projection.test.tsx.

**TDD:** Semantic RED on existing route/frontend, not missing-helper imports. Real route + real cache/core + real mapper, boundary mocks for auth/Prisma/readiness/mode dependencies. Test hit/miss both orders, full cache identity/no mutation/frozen values/future fields, roles/auth before reads, SQL/readiness errors, empty/null/zero/duplicate names/equal-distance order; exact fallback, ignored projection on other views/downloads, generation setter unchanged/no extra queries/writes. Actual customer map component with Leaflet/session/modal/browser/fetch boundary mocks; nearest/selection/polyline/assignment-confirmation and unchanged PUT payloads, projected URL/legacy customer URL, role/customer data/list/search/GPS/create/edit boundaries as relevant. Do not alter any old21UI/unit assertions, including Node0TB slice.

**Parent:** Snapshot412files/326sources/75dirty; prove existing built YtnPeN... identity from actual prior manifest (do not assume guessed string). New private copy of known synthetic batch6 SQLite for fixture. Guard env discovery for both roots, explicit empty Turso and dummy auth. Baseline must be captured before candidate build; next start not dev, do not race source editing/build.

**Runtime/metrics:**3roles×desktop/mobile, with optional app theme cases; actual local API hashes default/customer/other-mode scopes, projected nodes exact allowlist/order; one node request, no waterfall, nearest confirmation matches/cancel without business writes. Mock provider images only, auth/data API success real fake DB, forced GPS denial/error separate. UI text/button/disabled/overflow and explicit nearest results are summaries, NOT full DOM equivalence. Screenshots diagnostic only for this functional slice; no manufactured strict visual PASS, previous Node0TB3PNG/2geometry debt remains OPEN unchanged.

**Benchmark:** Frozen pure mapper same dataset both sides1k/10k/50k, minimal and ordinary metadata; decoded JSON bytes not transfer/latency/render/DB query proof.

**QA:** New focused tests + all UI + existing cache/generation/schema/read-only regressions,22policy/full types/lint/build, primary scoped post-integration and329source-byte match. No rerun/skip/pool/upgrade of known full native suite801/815 failure. Native/strict visual/release acceptance stays open; Task9 overall not complete.

- [x] Snapshot412files/326sources/75changes; baseline build YtnPeNtbqpjYz_Ui49Djz reused after source identity checks;12cases complete,3312byte node payload/14nodes, scoped customers unchanged/no business write.
- [x] Plan review APPROVE; worker semantic RED11fail/34pass -> GREEN45/45 (33unit+12UI), owned type/lint và mechanical reversals đạt. Giữ first scoped validation harness failure (thiếu UI setup types), không sửa app để né lỗi helper.
- [x] Frozen6hashes; independent spec Parfit then quality Hegel APPROVE source/API local-functional only, no source changes. Primary/WT preimages and all old tests preserved; visual/native/release gates not waived.
- [x] WT32file/470scoped+22policy/full types/lint/build, login static;0error/2old warnings. Browser12cases:3312→1268decoded node bytes(-61,71%), legacy/customer/scoped hashes/48summaries/nearest/polyline preserved/no writes/errors. Six size-only rows58,03–66,45%; not SQL/latency/render/pixel proof.
- [x] Backup/hash/whitespace/default secret scan không finding; tích hợp đúng10file local, giữ75 thay đổi trước. Primary32file/470scoped+22policy/full types/lint0error/2old warnings, frozen hashes/fake DB unchanged;329source/config/test byte-match built WT. Progress section33; no commit/push/deploy, Task9/native/strictvisual/release still OPEN.

**Alternatives:** Dropping default fields breaks node popup/CSV; slim SQL/new cache adds correctness scope. Choose response-only projection reusing same full cache. Further customer-marker DTO, full node-map/detail separation, SQL/lookup optimizations and existing visual/native gaps remain separate.

**Continuation 29/10:** First worker hit account usage limit before any repository edit/test. Parent confirmed primary/WT match original snapshot. No approval/implementation result inferred from that failure; a fresh worker resumes the same approved six-file scope.

**Baseline helper:** Preserved v1 false-positive network failure for intercepted synthetic provider tiles that Leaflet aborts on zoom/reload. Final classifier only exempts exact intercepted tile-image URLs with ERR_ABORTED, plus existing narrow nonnavigation RSC prefetch rule; all API/script/navigation/unexpected failures still fail. No app/old-test or native changes.
