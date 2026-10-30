# Node0TB map projection — local implementation plan 28/10/2026

> Approved Task9 continuation: reduce map payload, preserve UI/business/permissions, local only. Use subagent-driven-development, TDD, spec then quality review. No commit/push/deploy. Reuse detached WT, preserve67 primary changes and known native failures.

**Goal:** Send only fields consumed by Node0TB map without changing legacy full endpoint, SQL/matching/statistics or map behavior.

**Architecture:** Keep getNode0TbList untouched. Add pure allowlist projection of its result at GET /api/node-0tb?projection=map after existing authentication/search/category/full-list path. No new endpoint, per-marker request, cache or flag. Absent/unknown projection keeps exact legacy payload. Map opts in and uses narrower DTO types only; existing JSX/styles/state/dataflow and user actions stay unchanged.

**DTO:** Node0TbMapItem = Pick<Node0TbItem, id|nodeCode|dateKdFormatted|totalPort|categoryKd|latitude|longitude|hasCoordinates>. Node0TbMapResponse retains nodes/stats/categories with projected nodes. Exclude unused dateKd, usedPort, note, nodeDescription, createdAt, updatedAt; server description search still runs before projection. No business row deletion; default API/upload/template unchanged.

**Alternatives:** Changing default API risks consumers; query/matching rewrite risks precedence and scope. Choose opt-in wire projection first. Do not claim SQL/backend-time savings; projection still reads legacy data. No bbox/clustering/virtualization or library/SSR changes.

**Files (worker):**
- Modify src/types/index.ts (add DTO types, retain original models).
- Create src/lib/node-0tb-map.ts (pure allowlist mapper projectNode0TbMapData, no DB/auth import).
- Modify src/app/api/node-0tb/route.ts (one exact projection whitelist after full-list result).
- Modify src/app/(dashboard)/node-0tb/Node0TbMap.tsx (narrow type names and fetch URL only).
- Create tests/unit/node-0tb-projection.test.ts (real route+getNode0TbList/mapper with auth/Prisma/readiness boundary mocks; no native binding). Existing node-0tb-map.test.ts tile-provider regression is retained unchanged.
- Create tests/ui/node-0tb-map-projection.test.tsx (real component with boundary Leaflet/Session/fetch mocks).

**Red/green:** Tests must fail semantically on old endpoint/frontend, not missing-new-module imports. Test route-selected fields, exact values/null/zero/escaped strings, order, full stats/categories before search/category, empty lists, exact/base/prefix precedence/missing coords, legacy/unknown projection, auth-before-query and errors. No SQL writes or N extra queries. UI verifies projected URL, stats/filter/search/list/popup retained, error/retry, all roles' existing admin actions and refresh URL. Keep all old20 UI files/assertions unchanged.

**Parent QA:** Snapshot407files/323 matching sources/67 prior changes, fake fixture copy only. Baseline must be rebuilt because previous CSS candidate build is stale. Freeze baseline build identity before worker changes. Reuse isolated port3006 and env-file guard; no real env/DB/cloud, provider tiles fulfilled locally, business writes blocked.

**Browser/measure:** Same fake SQLite fixture before/after,3roles×desktop/mobile×light/dark. Compare actual API rows against legacy allowlist and unchanged stats/categories; map UI/search/list/category/popup/fit/zoom/GPS-denied/error-retry behavior and screenshots/DOM where deterministic. Record exact response bytes and request count; no fake API response for payload-equivalence. Map tile images may be synthetic, explicitly separate from API evidence. Size-only projected DTO benchmark1k/10k/50k has same values each side and includes minimal/null and ordinary metadata cases; do not inflate notes to hit target or claim this as browser-render/performance scale test.

**Native gate:** Existing primary801/815 crash stays open. Scoped/new/UI/policy/types/lint and build gates must pass; no retries/skips/pool changes or claim Windows fixed. Broader suite if run is single attempt with original failure retained, not required to erase known native warning for this local slice. No release acceptance claim. Primary scoped QA/source-byte match still required after integration.

- [x] Snapshot407files/323sources/67changes; independent fake fixture16rows/12coords, rebuild baseline RISMKc2FOqE6SYLyjfasZ,12browser cases with6scenes each; initial JSON6166bytes.
- [x] Plan review corrected collision; clean semantic RED12fail/41pass -> GREEN53;26newunit+11newUI, all20oldUI and tile/readiness unchanged.
- [x] Freeze6paths; spec Franklin and quality Ramanujan APPROVE source/API only. Runtime image gate still must resolve, no blanket performance/release approval.
- [x] Candidate387scoped+22policy/types/lint/build; actual API6166->3203(-48.05%) and72UI summaries match, six size-only benchmarks44.32-51.44%. Not fullDOM/pixel acceptance.
- [ ] Resolve strict visual gate: controlled45/48PNG match,3PNG and2error geometry mismatches unexplained. Original assertions/exit1 retained, no image waiver or strict-success artifact.
- [x] Independent LOCAL FUNCTIONAL ONLY disposition; backup/hash/default secret scan/whitespace, reversible11file checkpoint. Primary26files/387scoped+22policy/types/lint pass,326sources match built WT,67prior changes preserved. Progress section32; no slice/Task9/native/release completion or publish.

**Acceptance:** Measured payload smaller on same fixture (target≥50% where enough fields removable, actual result must be reported). Zero coordinates preserved, no fake coordinates/dropped unmapped nodes, stats/categories/order and matching identical. No changed popup/actions/filter/search/role semantics, legacy payload contract exact. Full Task9/customer/node projection, lookup optimization,50k browser render, slow-network/real devices and native reliability remain separate.

**Plan review:** Hypatia found name collision with existing tests/unit/node-0tb-map.test.ts; corrected to new node-0tb-projection.test.ts before implementation, preserve old tile regression. Architecture approved,8fields sufficient. Pin all roles' existing read access/admin-only controls, auth-before-readiness, rejection500-before-data, one Node0Tb SELECT+one findMany after readiness.

**Baseline harness notes:** Old synthetic fixture had2Node0Tb rows, not empty; failed before seeding. Verified untouched copied DB/snapshot, then cleared Node0Tb only in new synthetic copy and seeded16rows; original fake DB hash retained. Browser v1 expected injected server-error body, but existing UI deliberately displays generic HTTP-error message; preserved helper/log/PNGs then corrected locator only. No application/assertion/native workaround.12final baseline cases completed, no business write/JS error/unexpected network failure, synthetic DB hash unchanged.

**Local checkpoint disposition:** Avicenna independently approves LOCAL FUNCTIONAL ONLY, not visual/native/release acceptance. Exact mechanical UI source reversal, API/legacy hashes and scoped tests support reversible local integration despite unresolved strict capture differences.72matches are UI summaries, not completeDOM. Strict browser.cjs/integrate.cjs/finalize.cjs and their failures remain intact; separate functional-comparison/integrate-functional/finalize-functional helpers explicitly retain strictVisualGatePassed=false and completeForNode0TbProjectionSlice=false. No authored app edits or further retry to chase pixel PASS.
