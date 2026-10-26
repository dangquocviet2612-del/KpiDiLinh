# Product-Wide UI Improvement Roadmap

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the complete CRM UI without changing business rules, API contracts, permissions, or data models, prioritizing accessibility, operational safety, responsive consistency, and maintainability.

**Architecture:** Build a small shared interaction layer first, then migrate product areas incrementally. Preserve existing route shapes and domain hooks; move repeated page-shell, state, filter, dialog, and destructive-action behavior into tested shared components rather than redesigning every screen independently.

**Tech Stack:** Next.js App Router, React 19, TypeScript, CSS Modules, Lucide, React Hot Toast, Vitest, React Testing Library, axe, optional Playwright visual smoke tests.

---

## 1. Audit Summary

### What Is Already Strong

- Shared color tokens and action classes exist in `src/app/globals.css`.
- Role-aware navigation and light/dark theme exist in `src/components/Sidebar.tsx`.
- Customers, Churn Risk, maps, and several Prepaid views already distinguish loading, empty, and data states.
- Customers and Prepaid have deliberate desktop/mobile structures instead of shrinking desktop tables blindly.
- `PrepaidPanelState.tsx`, `MapSearchResults.tsx`, pagination, skeleton, and map controls are good seeds for reusable primitives.
- The map suite has recently added explicit GPS, error/retry, safer popup HTML, touch controls, and responsive bottom sheets.

### Evidence-Based Gaps

- Native blocking feedback remains widespread: 27 `alert()` and 7 `confirm()` calls across CTV, Logs, Archive, Notes, and Node Map.
- The repository contains about 162 inline style objects, making theme/responsive fixes difficult to apply consistently.
- Main customer/account/import modals do not expose complete `role="dialog"`, `aria-modal`, focus trapping, focus restoration, and consistent Escape behavior.
- No `prefers-reduced-motion` handling exists, while login, sidebar, loading, and menu transitions animate.
- Global mobile targets remain too small in places: `.ui-icon-btn` is about 31px and `.ui-filter-chip` about 32px in `src/app/globals.css`.
- Only `MapSearchResults` has a render-level UI test; most UI tests cover pure helpers or source configuration rather than user interactions.
- Large maintenance hotspots remain: `prepaid/kpi.module.css` (~3,168 lines), `PrepaidPageImpl.tsx` (~1,115 lines), `customers.module.css` (~1,671 lines), and the three map clients (~900–1,600 lines each).
- The dashboard shell has one mobile breakpoint at 768px; tablet widths and keyboard navigation receive limited dedicated handling.
- Login uses a purple visual language while the authenticated product uses teal/navy, and login feedback is not announced through an accessible live region.

## 2. Product Area Map

| Product area | Current UI maturity | Highest-value improvement |
|---|---|---|
| App shell and navigation | Functional, role-aware, responsive | Keyboard/focus behavior, tablet layout, clearer information architecture |
| Authentication and password | Simple and usable | Brand consistency, password affordances, accessible feedback |
| Customer CRM | Strongest operational screen | Form semantics, menu/dialog accessibility, safer bulk actions |
| Customer/Node/Node 0TB maps | Recently hardened | Shared toolbar/legend primitives, tile policy, non-map fallback, performance |
| KPI/Billing/CDT/Disconnect | Good state handling but highly duplicated | Shared report shell, filter system, table/card primitives, CSS decomposition |
| Churn Risk | Clear loading/empty states | Remove inline layout, accessible import dialog, mobile filter consistency |
| CTV and KPI configuration | Feature-rich but blocking feedback | Split responsibilities, inline validation, save/dirty status, safe delete |
| Official Documents | Complete editor workflow | List/detail/editor hierarchy, accessible modal, unsaved-change protection |
| Logs, backup, restore, archive | Operational but high-risk | Impact preview, typed confirmation, progress/result summaries |
| Tools and QR | QR is polished; iframe tools are opaque | Loading/error/reload shell, responsive metadata, accessibility boundaries |

## 3. Priorities

### P0 — Safety and Accessibility Foundation

Must be completed before visual redesigns because every later screen benefits from it.

1. Shared dialog/focus management.
2. Shared confirm/result feedback replacing browser dialogs.
3. Keyboard focus, reduced motion, skip navigation, and 44px mobile targets.
4. Shared loading/error/empty/retry semantics.

### P1 — Core Daily Workflows

1. Customer CRM and customer forms.
2. Maps and node operations.
3. KPI/Billing/CDT/Disconnect report shell.
4. CTV management and admin operations.

### P2 — Secondary Workflows and Maintainability

1. Official Documents and Churn Risk.
2. Tools, login, password change.
3. Visual regression and accessibility automation.
4. CSS/component decomposition and performance follow-up.

---

## 4. Implementation Plan

### Task 1: Establish UI Test and Accessibility Baseline — P0

**Files:**
- Modify: `package.json`
- Modify: `vitest.config.mts`
- Create: `tests/setup/ui.ts`
- Create: `tests/ui/app-shell.test.tsx`
- Create: `tests/ui/dialog.test.tsx`
- Create: `tests/ui/page-state.test.tsx`

- [ ] Add React Testing Library, `user-event`, `jest-dom`, jsdom, and axe-compatible test tooling.
- [ ] Keep existing node-environment unit tests unchanged; opt UI tests into jsdom explicitly.
- [ ] Add reusable test helpers for rendering Providers and asserting no critical axe violations.
- [ ] Capture baseline tests for keyboard navigation, focus return, live-region feedback, and mobile action labels.
- [ ] Document the supported viewport matrix: 360, 390, 768, 1024, and 1440 pixels.

**Acceptance:** UI tests run with `npm.cmd test`; no existing unit suite changes behavior.

### Task 2: Create Shared Interaction Primitives — P0

**Files:**
- Create: `src/components/ui/Dialog.tsx`
- Create: `src/components/ui/ConfirmDialog.tsx`
- Create: `src/components/ui/AsyncState.tsx`
- Create: `src/components/ui/FormField.tsx`
- Create: `src/components/ui/ActionMenu.tsx`
- Create: `src/components/ui/ui.module.css`
- Modify: `src/app/globals.css`
- Test: `tests/ui/dialog.test.tsx`
- Test: `tests/ui/page-state.test.tsx`

- [ ] Implement dialog title/description relationships, Escape close, backdrop close policy, focus trap, focus return, and body scroll lock.
- [ ] Implement confirm variants for normal, warning, destructive, and typed-confirmation operations.
- [ ] Implement shared loading, empty, error, stale-data warning, and retry states with `role="status"`/`role="alert"` where appropriate.
- [ ] Implement labelled form fields with hint/error IDs and `aria-invalid` wiring.
- [ ] Implement an action menu with outside-click, Escape, arrow-key navigation, and focus restoration.
- [ ] Add global `:focus-visible`, `prefers-reduced-motion`, skip-link, and 44px coarse-pointer target rules.
- [ ] Add semantic z-index, spacing, control-height, typography, and surface tokens instead of adding more hardcoded values.

**Acceptance:** Shared primitives pass keyboard and axe tests in light and dark themes.

### Task 3: Harden App Shell and Navigation — P0

**Files:**
- Modify: `src/app/(dashboard)/layout.tsx`
- Modify: `src/app/(dashboard)/layout.module.css`
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/components/Sidebar.module.css`
- Modify: `src/components/DashboardScrollTop.tsx`
- Test: `tests/ui/app-shell.test.tsx`

- [ ] Add a skip link targeting `data-dashboard-main`.
- [ ] Translate “Open Menu” and “Close Menu” labels to Vietnamese.
- [ ] Make the mobile sidebar a labelled navigation dialog with Escape close and focus restoration.
- [ ] Preserve visible current-location context after submenu navigation instead of collapsing all context immediately.
- [ ] Add a tablet state between mobile and the fixed 260px desktop sidebar.
- [ ] Group navigation by `Khách hàng`, `Hạ tầng`, `Báo cáo`, `Quản trị`, and `Tiện ích` while preserving role visibility and URLs.
- [ ] Ensure browser back/forward restores the correct expanded group and active link.

**Acceptance:** Entire navigation is usable with keyboard only at desktop and mobile widths.

### Task 4: Replace Blocking Alerts and Destructive Flows — P0

**Files:**
- Modify: `src/app/(dashboard)/ctv/CtvClient.tsx`
- Modify: `src/app/(dashboard)/logs/page.tsx`
- Modify: `src/app/(dashboard)/archive/page.tsx`
- Modify: `src/app/(dashboard)/node-map/NodeMapComponent.tsx`
- Modify: `src/components/CustomerNotesRefined.tsx`
- Reuse: `src/components/ui/ConfirmDialog.tsx`

- [ ] Replace all user-facing `alert()` calls with toast, inline result banners, or import-result dialogs.
- [ ] Replace all destructive `confirm()` calls with the shared confirmation component.
- [ ] Require typed confirmation for database restore, archive purge, and broad log deletion.
- [ ] Show affected record counts and irreversible consequences before confirmation.
- [ ] Keep action buttons disabled and visibly busy for the full request duration.
- [ ] Return focus to the initiating control after cancel/success.

**Acceptance:** `rg 'alert\(|confirm\(' src/app src/components` finds no product-flow usage except documented emergency fallback code.

### Task 5: Standardize Async Page States — P0

**Files:**
- Modify: `src/app/(dashboard)/loading.tsx`
- Modify: `src/app/(dashboard)/error.tsx`
- Modify: `src/components/SkeletonTable.tsx`
- Modify: `src/app/(dashboard)/prepaid/PrepaidPanelState.tsx`
- Modify: `src/app/(dashboard)/ctv/CtvClient.tsx`
- Modify: `src/app/(dashboard)/logs/page.tsx`
- Modify: `src/app/(dashboard)/archive/page.tsx`
- Modify: `src/app/(dashboard)/churn-risk/page.tsx`

- [ ] Move inline loading/error styles into shared CSS primitives.
- [ ] Distinguish first-load skeleton, background refresh, empty result, permission denial, and fatal error.
- [ ] Preserve existing data during background refresh and display a non-blocking stale-data indicator.
- [ ] Add retry actions to CTV, Logs, Archive, and Churn states where missing.
- [ ] Ensure state changes are announced without repeatedly interrupting screen readers.

**Acceptance:** Every data screen has explicit loading, empty, error, retry, and refreshing behavior.

### Task 6: Improve Customer CRM Workflow — P1

**Files:**
- Modify: `src/app/(dashboard)/customers/page.tsx`
- Modify: `src/app/(dashboard)/customers/customers.module.css`
- Modify: `src/components/CustomerModalRefined.tsx`
- Modify: `src/components/CustomerModal.module.css`
- Modify: `src/components/CustomerTableRefined.tsx`
- Modify: `src/components/CustomerNotesRefined.tsx`
- Test: `tests/ui/customer-workflow.test.tsx`

- [ ] Add explicit labels to search and all desktop/mobile filters; do not rely on placeholders or `title`.
- [ ] Migrate the action menu, delete confirm, customer modal, and unsaved-change confirm to shared primitives.
- [ ] Connect every label to its input and expose validation errors with `aria-describedby`.
- [ ] Keep bulk selection/actions sticky and visible without covering rows on mobile.
- [ ] Add a purposeful no-results state that offers “Xóa bộ lọc” and preserves the search query.
- [ ] Announce import summaries and provide a persistent downloadable error report link.
- [ ] Split `customers.module.css` by page shell, table/card, filters, and modal during migration without changing appearance wholesale.

**Acceptance:** Create, edit, notes, filtering, import, selection, and delete work by keyboard and at 360px width.

### Task 7: Consolidate the Three Map Experiences — P1

**Files:**
- Create: `src/components/map/MapToolbar.tsx`
- Create: `src/components/map/MapViewportControls.tsx`
- Create: `src/components/map/MapLegend.tsx`
- Create: `src/components/map/MapPanel.tsx`
- Create: `src/lib/map-tiles.ts`
- Modify: `src/app/(dashboard)/map/MapComponent.tsx`
- Modify: `src/app/(dashboard)/node-map/NodeMapComponent.tsx`
- Modify: `src/app/(dashboard)/node-0tb/Node0TbMap.tsx`
- Modify: `src/app/(dashboard)/map/map.module.css`
- Modify: `src/app/(dashboard)/node-map/node-map.module.css`
- Test: `tests/ui/map-toolbar.test.tsx`

- [ ] Centralize tile URLs, attribution, dark treatment, and provider fallback policy.
- [ ] Reuse one search/action/style control pattern across all three maps.
- [ ] Add a compact legend that explains marker/cluster colors and category meaning.
- [ ] Provide an accessible list fallback for users who cannot operate the map canvas.
- [ ] Keep explicit GPS permission and error/retry behavior already implemented.
- [ ] Move import result summaries from blocking alerts into a scrollable result dialog.
- [ ] Preserve mobile bottom sheets and 44px map controls.
- [ ] Coordinate with `docs/superpowers/plans/2026-03-25-web-performance.md` for viewport fetching and large marker datasets rather than duplicating that work.

**Acceptance:** The three maps share interaction behavior without changing domain-specific filters or popup data.

### Task 8: Build a Shared Report Shell for KPI/Billing/CDT — P1

**Files:**
- Create: `src/app/(dashboard)/prepaid/ReportPageShell.tsx`
- Create: `src/app/(dashboard)/prepaid/ReportToolbar.tsx`
- Create: `src/app/(dashboard)/prepaid/ReportFilterSheet.tsx`
- Create: `src/app/(dashboard)/prepaid/ResponsiveDataView.tsx`
- Split: `src/app/(dashboard)/prepaid/kpi.module.css`
- Modify: all `*PanelClean.tsx` files under `src/app/(dashboard)/prepaid/`
- Modify: `src/app/(dashboard)/prepaid/PrepaidPageImpl.tsx`
- Test: `tests/ui/prepaid-report-shell.test.tsx`

- [ ] Standardize page title, context summary, primary filters, secondary filters, actions, state, pagination, and mobile summary.
- [ ] Use one mobile filter sheet behavior instead of separate implementations per report.
- [ ] Standardize tables/cards for numeric alignment, sticky identifiers, sorting cues, and horizontal overflow affordances.
- [ ] Preserve the existing `PrepaidPanelState` behavior and make it the single state primitive for report panels.
- [ ] Extract route/view selection from the 1,100-line controller into a declarative view registry without moving data mutations into presentation components.
- [ ] Split the 3,000-line CSS module by shell, filters, tables/cards, KPI, CDT, billing, disconnect, and documents.
- [ ] Keep existing KPI formulas, permissions, and API parameters unchanged.

**Acceptance:** All report views share the same interaction order and mobile behavior; no metric calculation changes.

### Task 9: Separate CTV Management and KPI Configuration — P1

**Files:**
- Modify: `src/app/(dashboard)/ctv/CtvClient.tsx`
- Modify: `src/app/(dashboard)/ctv/ctv.module.css`
- Modify: `src/components/CtvModal.tsx`
- Modify: `src/components/CtvModal.module.css`
- Test: `tests/ui/ctv-management.test.tsx`

- [ ] Keep current URLs but make account management and KPI configuration explicit page sections with independent headers/state.
- [ ] Migrate CTV modal to the shared dialog and form-field primitives.
- [ ] Add row-level validation and save status for KPI config rather than only global browser alerts.
- [ ] Display dirty-row count and warn before leaving with unsaved changes.
- [ ] Add safe delete confirmation with user role, manager assignment, and impact summary.
- [ ] Preserve role and GPS permission behavior.

**Acceptance:** An admin can identify unsaved rows, recover from partial save failure, and edit users entirely by keyboard.

### Task 10: Redesign High-Risk Admin Operations — P1

**Files:**
- Modify: `src/app/(dashboard)/logs/page.tsx`
- Modify: `src/app/(dashboard)/logs/logs.module.css`
- Modify: `src/app/(dashboard)/archive/page.tsx`
- Modify: `src/app/(dashboard)/archive/archive.module.css`
- Create: `src/components/admin/OperationSummary.tsx`
- Create: `src/components/admin/BackupRestorePanel.tsx`
- Test: `tests/ui/admin-operations.test.tsx`

- [ ] Separate audit-log browsing from backup/restore into clearly labelled sections.
- [ ] Preview backup metadata before download and restore metadata before overwrite.
- [ ] Show selected log count/date range and archive month impact before destructive actions.
- [ ] Use typed confirmation for restore/purge and retain an operation result summary until dismissed.
- [ ] Add progress states for upload, validation, restore, archive export, confirm, cancel, and purge.
- [ ] Make tables/cards and selection controls usable at mobile and tablet widths.

**Acceptance:** No irreversible operation can be triggered without a visible impact summary and explicit confirmation.

### Task 11: Improve Churn Risk and Official Documents — P2

**Files:**
- Modify: `src/app/(dashboard)/churn-risk/page.tsx`
- Modify: `src/app/(dashboard)/churn-risk/churn-risk.module.css`
- Modify: `src/app/(dashboard)/prepaid/OfficialDocsPanel.tsx`
- Modify: `src/app/(dashboard)/prepaid/useOfficialDocsPanel.ts`
- Test: `tests/ui/churn-import.test.tsx`
- Test: `tests/ui/official-docs.test.tsx`

- [ ] Move Churn inline layout rules into CSS and align filters/import states with the shared report shell.
- [ ] Migrate the Churn import overlay and image URL overlay to accessible dialogs.
- [ ] Restructure Official Documents into stable list/detail/editor regions with clear mobile navigation.
- [ ] Add unsaved-change protection and visible save/publish state to the editor.
- [ ] Improve attachment upload progress, failed-file recovery, and media accessibility metadata.

**Acceptance:** Churn import and document editing support Escape, focus return, validation announcement, and mobile navigation.

### Task 12: Improve Tools, Login, and Password Flows — P2

**Files:**
- Modify: `src/app/(dashboard)/tools/ToolPageFrameClean.tsx`
- Modify: `src/app/(dashboard)/tools/page.module.css`
- Modify: `src/app/(dashboard)/tools/qr/QrToolClient.tsx`
- Modify: `src/app/login/page.tsx`
- Modify: `src/app/login/login.module.css`
- Modify: `src/app/(dashboard)/change-password/page.tsx`
- Create: `src/app/(dashboard)/change-password/change-password.module.css`
- Test: `tests/ui/auth-forms.test.tsx`
- Test: `tests/ui/tool-frame.test.tsx`

- [ ] Add iframe loading, timeout, error, reload, and “Mở cửa sổ riêng” states for embedded tools.
- [ ] Correct Vietnamese metadata strings and display tool purpose/context in the frame shell.
- [ ] Define iframe title, sandbox/referrer policy, and keyboard focus boundary deliberately.
- [ ] Add QR validation messages connected to fields and announce preview generation.
- [ ] Align login visuals with the product teal/navy identity and honor reduced motion.
- [ ] Add username/password autocomplete, password visibility toggle, Caps Lock warning, and live error status.
- [ ] Move password-change inline styles into a module and add show/hide, requirement checklist, and success focus management.

**Acceptance:** Auth and tools provide clear feedback without relying only on visual changes or iframe internals.

### Task 13: Add Visual Regression and Release Gates — P2

**Files:**
- Modify: `package.json`
- Create: `playwright.config.ts`
- Create: `tests/e2e/auth.setup.ts`
- Create: `tests/e2e/critical-ui.spec.ts`
- Create: `docs/ui-release-checklist.md`

- [ ] Add role-aware smoke coverage for ADMIN, MANAGER, and CTV.
- [ ] Capture light/dark screenshots at 390, 768, 1024, and 1440 widths for critical routes.
- [ ] Cover login, customers, all maps, KPI personal/summary, CTV, logs/archive, churn, official documents, and QR.
- [ ] Add automated checks for horizontal overflow, missing accessible names, and critical axe violations.
- [ ] Require unit tests, lint, TypeScript, production build, and critical UI smoke tests before UI releases.

**Acceptance:** Critical route screenshots and accessibility checks are repeatable locally and in CI.

---

## 5. Recommended Delivery Order

| Phase | Tasks | Outcome |
|---|---|---|
| Phase 0 | Task 1 | Objective UI baseline and regression safety |
| Phase 1 | Tasks 2–5 | Shared accessibility, feedback, shell, and state foundation |
| Phase 2 | Tasks 6–7 | Daily CRM and map workflows upgraded |
| Phase 3 | Tasks 8–10 | Reports and high-risk admin workflows standardized |
| Phase 4 | Tasks 11–12 | Secondary workflows, tools, and auth polished |
| Phase 5 | Task 13 | Visual/accessibility release gate |

Do not start by restyling colors or cards. Complete Tasks 1–5 first so later domain work does not recreate dialogs, loading states, filters, and confirmation behavior repeatedly.

## 6. Global Definition of Done

- [ ] No critical workflow relies on browser `alert()` or `confirm()`.
- [ ] All dialogs have an accessible name, Escape behavior, focus trap, and focus restoration.
- [ ] All inputs have programmatic labels; validation is announced and connected to the field.
- [ ] All coarse-pointer action targets are at least 44×44px unless documented as an exception.
- [ ] All routes handle loading, refreshing, empty, error, retry, and permission states.
- [ ] No horizontal page overflow at 360, 390, 768, 1024, or 1440px.
- [ ] Light/dark themes preserve readable contrast and do not depend on color alone for status.
- [ ] Reduced-motion users do not receive non-essential animation.
- [ ] ADMIN, MANAGER, and CTV navigation and actions remain permission-correct.
- [ ] Unit tests, UI interaction tests, lint, TypeScript, production build, and critical visual smoke tests pass.

## 7. Explicit Non-Goals

- No API contract, database schema, role permission, KPI formula, import format, or business-rule changes.
- No wholesale framework replacement or visual redesign detached from operational workflows.
- No simultaneous rewrite of every large file; each product area migrates after shared primitives are stable.
- No duplication of the existing backend performance roadmap; UI work should coordinate with `docs/superpowers/plans/2026-03-25-web-performance.md`.

No commits are created because the user requested an audit and plan, not repository integration.
