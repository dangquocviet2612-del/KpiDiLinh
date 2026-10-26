# Node 0TB Map Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the Node 0TB map to the same safe, accessible, and mobile-friendly interaction standard as the other map screens.

**Architecture:** Keep the existing Node 0TB client component and API contracts. Reuse the shared map search component, shared node-map CSS, and a tested helper in `src/lib/map-ui.ts` for values crossing from Leaflet HTML into browser events.

**Tech Stack:** Next.js App Router, React, TypeScript, React Leaflet, Leaflet MarkerCluster, CSS Modules, Vitest, ESLint.

---

### Task 1: Add Safe Popup Event Encoding

**Files:**
- Modify: `tests/unit/map-ui.test.ts`
- Modify: `src/lib/map-ui.ts`

- [ ] Add a failing test covering quotes, Unicode, and percent characters in a popup event value.
- [ ] Run `npm.cmd test -- --run tests/unit/map-ui.test.ts` and confirm the missing helper failure.
- [ ] Implement the smallest URI-safe encoder that also encodes apostrophes.
- [ ] Run the focused test and confirm it passes.

### Task 2: Harden Node 0TB Data and GPS Flows

**Files:**
- Modify: `src/app/(dashboard)/node-0tb/Node0TbMap.tsx`

- [ ] Replace silent fetch failures with checked responses and a visible retry state.
- [ ] Remove automatic geolocation and request it only from the location action.
- [ ] Show locating progress and useful errors without changing map data rules.
- [ ] Remove stale imports/state exposed by lint.
- [ ] Run focused ESLint and TypeScript checks.

### Task 3: Improve Map Navigation and Selection

**Files:**
- Modify: `src/app/(dashboard)/node-0tb/Node0TbMap.tsx`

- [ ] Bridge the Leaflet map instance to component actions.
- [ ] Add zoom-in, zoom-out, and fit-visible-node controls.
- [ ] Clear incompatible category filters before focusing a selected node.
- [ ] Retry marker popup focus after cluster rebuilds.
- [ ] Route popup copy through the tested safe event encoder.

### Task 4: Improve Accessibility and Mobile Interaction

**Files:**
- Modify: `src/app/(dashboard)/node-0tb/Node0TbMap.tsx`
- Reuse: `src/app/(dashboard)/node-map/node-map.module.css`

- [ ] Add combobox relationships to search and its results.
- [ ] Add expanded/pressed state to menus, style choices, and category filters.
- [ ] Label the list panel as a dialog and label its search/close controls.
- [ ] Reuse the shared error overlay, viewport controls, and mobile bottom sheet styles.
- [ ] Run focused tests and ESLint.

### Task 5: Validate the Complete Change

**Files:**
- Verify all modified files from Tasks 1-4.

- [ ] Run `npm.cmd test` and require all tests to pass.
- [ ] Run `npm.cmd run lint` and require zero errors.
- [ ] Run `npx.cmd tsc --noEmit` and require success.
- [ ] Run `git diff --check` and require success.
- [ ] Run the production build with safe local placeholder environment values.

No commits are created because the user did not request a commit.

### Task 6: Remove Tile Provider Watermark Regression

**Files:**
- Modify: `src/app/(dashboard)/node-0tb/Node0TbMap.tsx`
- Create: `tests/unit/node-0tb-map.test.ts`

- [x] Reproduce the screenshot issue and trace it to CartoDB tile URLs.
- [x] Add a failing regression test requiring a keyless OpenStreetMap base layer.
- [x] Replace light/dark CartoDB tiles while preserving Esri satellite mode.
- [x] Remove the duplicated toolbar title/count block to restore map canvas space.
- [x] Run the complete validation suite and production build.
