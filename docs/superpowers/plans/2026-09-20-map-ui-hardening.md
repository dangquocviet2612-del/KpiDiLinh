# Map UI Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the customer and node maps for safety, predictable search/filter behavior, mobile usability, accessibility, and operational feedback without rewriting the map modules.

**Architecture:** Keep the existing Leaflet and marker-cluster flows, add small tested map-formatting helpers, then make focused component and CSS changes. Reuse the existing shared search results component and global action styles; defer the large shared-map-shell refactor to a later task.

**Tech Stack:** Next.js 16 App Router, React 19, React Leaflet, Leaflet MarkerCluster, CSS Modules, Vitest.

---

### Task 1: Add tested map display helpers

**Files:**
- Create: `src/lib/map-ui.ts`
- Create: `tests/unit/map-ui.test.ts`
- Modify: `src/app/(dashboard)/map/MapComponent.tsx`
- Modify: `src/app/(dashboard)/node-map/NodeMapComponent.tsx`

- [ ] Add failing tests for HTML escaping and ratio-to-percent formatting.
- [ ] Run `npm.cmd test -- tests/unit/map-ui.test.ts` and confirm failure.
- [ ] Implement `escapeMapHtml` and `formatMapPercent`.
- [ ] Use the shared helpers in both map popup builders.
- [ ] Run the targeted test and confirm it passes.

### Task 2: Make shared search results keyboard accessible

**Files:**
- Modify: `src/components/MapSearchResults.tsx`
- Modify: `src/components/MapSearchResults.module.css`

- [ ] Replace mouse-only clickable list rows with semantic buttons.
- [ ] Preserve independent action buttons without nested interactive elements.
- [ ] Add focus-visible styling and minimum touch height.
- [ ] Verify both customer and node result renderers still compose correctly.

### Task 3: Harden customer map workflows

**Files:**
- Modify: `src/app/(dashboard)/map/MapComponent.tsx`
- Modify: `src/app/(dashboard)/map/map.module.css`

- [ ] Escape all customer values injected into Leaflet popup HTML.
- [ ] Make cluster tone reflect the highest-priority warning rather than the majority.
- [ ] Clear incompatible filters before focusing a search result and retry marker opening after the cluster rebuild.
- [ ] Replace automatic geolocation with an explicit user action and loading feedback.
- [ ] Add load-error/retry state and a compact map-control group for zoom and fit-all.
- [ ] Add filter counts, `aria-pressed`, search labeling, and dialog semantics.
- [ ] Increase mobile map-control touch targets and use `100dvh`.

### Task 4: Improve node map workflows

**Files:**
- Modify: `src/app/(dashboard)/node-map/NodeMapComponent.tsx`
- Modify: `src/app/(dashboard)/node-map/node-map.module.css`

- [ ] Replace color-only filter labels with operational labels and descriptions.
- [ ] Clear incompatible color/radius filters before focusing search results.
- [ ] Replace automatic geolocation with an explicit user action and remove the GPS alert flow.
- [ ] Add load-error/retry state plus zoom and fit-all controls.
- [ ] Add `aria-pressed`, search labeling, and accessible labels for panel controls.
- [ ] Render mapping/account panels as a mobile bottom sheet and enlarge primary touch targets.

### Task 5: Validate the complete change

**Files:**
- Verify: `src/app/(dashboard)/map/**`
- Verify: `src/app/(dashboard)/node-map/**`
- Verify: `src/components/MapSearchResults.*`

- [ ] Run targeted map helper tests.
- [ ] Run `npm.cmd test`.
- [ ] Run `npm.cmd run lint` and distinguish existing warnings from new issues.
- [ ] Run `npm.cmd run build` with review-safe environment variables.
- [ ] Run `git diff --check` and inspect the final diff for scope creep.
