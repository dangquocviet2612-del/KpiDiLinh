# KPI Calculator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new KPI calculator screen for admin/manager that simulates personal KPI completion by editing only `TH giả lập` and reusing the exact scoring logic from the real personal KPI flow.

**Architecture:** Move KPI row/group scoring into a reusable helper so the personal KPI report route and the calculator share one scoring pipeline. Add a calculator API plus dedicated panel/hook, then wire a new `kpi-calculator` view into the prepaid module and KPI submenu.

**Tech Stack:** Next.js App Router, React client components, TypeScript, Prisma, CSS modules, existing prepaid panel patterns.

---

### Task 1: Extract reusable KPI scoring helper

**Files:**
- Create: `src/lib/kpi-report-calculation.ts`
- Modify: `src/app/api/kpi/report/route.ts`
- Test: `tmp/kpi-report-calculation.test.ts`
- Test config: `tmp/tsconfig.kpi-report-calculation.test.json`

- [ ] Write failing helper tests for positive KPI, negative KPI, Cước N1-N3, merge-group aggregation, and total score aggregation.
- [ ] Run the helper test to confirm it fails for the missing shared module.
- [ ] Implement the reusable scorer with row mapping and merge-group aggregation.
- [ ] Update `kpi/report` to consume the helper instead of duplicating the logic.
- [ ] Re-run the helper test and ensure it passes.

### Task 2: Add KPI calculator API

**Files:**
- Create: `src/app/api/kpi/calculator/route.ts`
- Modify: `src/app/api/kpi/report/route.ts` (only if shared types/helpers need export cleanup)
- Test: `tmp/kpi-calculator-access.test.ts`
- Test config: `tmp/tsconfig.kpi-calculator-access.test.json`

- [ ] Write a failing test for access control and simulation input normalization helpers if needed.
- [ ] Add a new route that loads the same base personal KPI dataset for a selected CTV/date.
- [ ] Restrict the route to `ADMIN` and `MANAGER`.
- [ ] Return rows/totals ready for client-side simulation.
- [ ] Re-run the new tests.

### Task 3: Build calculator panel and hook

**Files:**
- Create: `src/app/(dashboard)/prepaid/useKpiCalculator.ts`
- Create: `src/app/(dashboard)/prepaid/KpiCalculatorPanel.tsx`
- Modify: `src/app/(dashboard)/prepaid/kpi.module.css`

- [ ] Add a hook that fetches calculator source data, tracks editable `TH giả lập`, and recalculates totals locally.
- [ ] Keep `TH giả lập` initialized from `TH hiện tại` and add reset/reload actions.
- [ ] Build a desktop table and mobile card UI using existing prepaid patterns.
- [ ] Add summary cards for current score, simulated score, delta, and missing-to-100.
- [ ] Keep all visible strings UTF-8-clean.

### Task 4: Wire calculator view into prepaid and sidebar

**Files:**
- Modify: `src/app/(dashboard)/prepaid/PrepaidPageImpl.tsx`
- Modify: `src/components/Sidebar.tsx`

- [ ] Add `?view=kpi-calculator` route handling.
- [ ] Redirect `CTV` away from the calculator view.
- [ ] Add the `Tính KPI` submenu item for `ADMIN/MANAGER` only.
- [ ] Ensure calculator state does not affect the existing personal KPI screen.

### Task 5: Verify

**Files:**
- No code changes expected

- [ ] Run `npm.cmd run -s lint -- --ignore-pattern tmp/edge-review/**`.
- [ ] Run `npm.cmd run -s build`.
- [ ] Manually sanity-check `/prepaid?view=kpi-calculator` as `ADMIN/MANAGER`.
- [ ] Confirm `CTV` is redirected away from the calculator view.
