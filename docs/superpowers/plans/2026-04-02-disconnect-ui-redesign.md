# Disconnect UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a compact, premium Disconnect (Rời mạng) UI with advanced filters in a popover, file actions in a dropdown, and cleaner mobile filter summary + card visuals.

**Architecture:** Keep all data/permissions logic intact. Add a small UI helper for mobile filter summary string. Update `DisconnectPanelClean.tsx` to reorganize toolbar and mobile filters, and extend `kpi.module.css` with new layout/visual classes for popover, dropdown, summary progress, and mobile card borders.

**Tech Stack:** Next.js (App Router), React, CSS Modules (`kpi.module.css`), lucide-react icons.

---

## File Structure & Responsibilities
- **Modify** `src/app/(dashboard)/prepaid/DisconnectPanelClean.tsx`
  - Desktop toolbar layout (primary filters + action dropdown + advanced filters popover).
  - Mobile filter summary line and bottom sheet-style filter panel.
  - Summary cards: add overdue ratio bar and status visuals.
  - Mobile cards: add status border and cleaner badges.
- **Modify** `src/app/(dashboard)/prepaid/kpi.module.css`
  - New/updated classes for toolbar grid, popover, dropdown, summary ratio bar, mobile filter summary, and card status borders.
- **Create** `src/lib/disconnect-ui.ts`
  - Helper `buildDisconnectMobileFilterSummary` to generate the condensed “Đang áp dụng (n)” line and optional detail text (32 chars max).
- **Create** `disconnect-ui.test.ts`
  - Minimal node assert test for the helper behavior and truncation.

---

### Task 1: Add helper for mobile filter summary (TDD)

**Files:**
- Create: `src/lib/disconnect-ui.ts`
- Create: `disconnect-ui.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import assert from "node:assert/strict";
import { buildDisconnectMobileFilterSummary } from "./src/lib/disconnect-ui";

const base = {
  activeCount: 3,
  cancelMonthLabel: "Tháng 03",
  sourceLabel: "Truyền hình",
};

const summary = buildDisconnectMobileFilterSummary(base);
assert.equal(summary.title, "Đang áp dụng (3)");
assert.equal(summary.detail, "Tháng 03 · Truyền hình");

const summary2 = buildDisconnectMobileFilterSummary({
  activeCount: 1,
  cancelMonthLabel: "Tháng 03",
  sourceLabel: "",
});
assert.equal(summary2.detail, "Tháng 03");

const summary3 = buildDisconnectMobileFilterSummary({
  activeCount: 2,
  cancelMonthLabel: "Tháng 03",
  sourceLabel: "Nguồn có tên rất rất dài",
});
assert.equal(summary3.detail?.length <= 32, true);

console.log("disconnect ui helper tests passed");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --loader ts-node/esm disconnect-ui.test.ts`
Expected: FAIL with module not found for `buildDisconnectMobileFilterSummary`.

- [ ] **Step 3: Write minimal implementation**

```ts
export function buildDisconnectMobileFilterSummary(args: {
  activeCount: number;
  cancelMonthLabel?: string;
  sourceLabel?: string;
}) {
  const { activeCount, cancelMonthLabel, sourceLabel } = args;
  const parts = [cancelMonthLabel, sourceLabel].filter((value) => value && value.trim());
  let detail = parts.join(" · ");
  if (detail.length > 32) detail = `${detail.slice(0, 31)}…`;
  return {
    title: `Đang áp dụng (${activeCount})`,
    detail: detail || undefined,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --loader ts-node/esm disconnect-ui.test.ts`
Expected: PASS with “disconnect ui helper tests passed”.

- [ ] **Step 5: Commit**

```bash
git add disconnect-ui.test.ts src/lib/disconnect-ui.ts
git commit -m "test: add disconnect mobile filter summary helper"
```

---

### Task 2: Desktop toolbar layout + dropdown + popover

**Files:**
- Modify: `src/app/(dashboard)/prepaid/DisconnectPanelClean.tsx`
- Modify: `src/app/(dashboard)/prepaid/kpi.module.css`

- [ ] **Step 1: Write the failing test**

```ts
// No automated DOM test available for this UI-only change.
// Verification will be manual (desktop layout + popover + dropdown).
```

- [ ] **Step 2: Implement toolbar structure**

- Move CTV/Manager/Import Source into a popover under “Bộ lọc nâng cao”.
- Replace file buttons with a “Thao tác ▾” dropdown (admin only) containing exactly: `Tải file mẫu` and `Tải file rời mạng`.
- Keep “Làm mới” visible.
- Ensure permission gating reuses existing flags (`canAdmin`, `canSelectCtv`).

- [ ] **Step 3: Implement styles**

- Add CSS for dropdown menu + popover container.
- Make toolbar left filters a 2-row grid when needed (max 2 rows).

- [ ] **Step 4: Manual verification**

Check on desktop:
- Primary filters visible.
- Popover opens directly below trigger, closes on outside click, and is keyboard-focusable.
- Dropdown shows exactly `Tải file mẫu` + `Tải file rời mạng` and closes on selection; keyboard focus/escape works.
- At ~1024px width, popover and dropdown remain aligned and visible.
- Toolbar height reduced by at least one row vs previous layout.

- [ ] **Step 5: Commit**

```bash
git add src/app/(dashboard)/prepaid/DisconnectPanelClean.tsx src/app/(dashboard)/prepaid/kpi.module.css
git commit -m "ui: compact disconnect toolbar with popover and dropdown"
```

---

### Task 3: Summary cards ratio bar + premium styling

**Files:**
- Modify: `src/app/(dashboard)/prepaid/DisconnectPanelClean.tsx`
- Modify: `src/app/(dashboard)/prepaid/kpi.module.css`

- [ ] **Step 1: Implement overdue ratio bar**

- Add a thin progress bar in the Overdue card, width = `overdue / total`.
- Use subtle colors consistent with existing theme.

- [ ] **Step 2: Adjust summary card styles**

- Reduce heavy gradient.
- Increase padding and typography spacing.

- [ ] **Step 3: Manual verification**

- Ratio bar renders correctly for zero and non-zero totals.

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/prepaid/DisconnectPanelClean.tsx src/app/(dashboard)/prepaid/kpi.module.css
git commit -m "ui: refresh disconnect summary cards with ratio bar"
```

---

### Task 4: Mobile filter summary + card status cues

**Files:**
- Modify: `src/app/(dashboard)/prepaid/DisconnectPanelClean.tsx`
- Modify: `src/app/(dashboard)/prepaid/kpi.module.css`

- [ ] **Step 1: Replace chip list with single summary line**

- Use `buildDisconnectMobileFilterSummary` for title + optional detail.
- Keep the toggle button for the bottom sheet panel.

- [ ] **Step 2: Mobile cards status styling**

- Add left border color for overdue vs upcoming.
- Ensure badges remain readable.

- [ ] **Step 3: Manual verification**

- On mobile widths, confirm summary line truncates to 32 chars and bottom sheet opens.

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/prepaid/DisconnectPanelClean.tsx src/app/(dashboard)/prepaid/kpi.module.css
git commit -m "ui: streamline disconnect mobile filters and card status"
```

---

### Task 5: Final verification

**Files:**
- None

- [ ] **Step 1: Run lint**

Run: `npm run lint`
Expected: no lint errors.

- [ ] **Step 2: Manual smoke test**

- Desktop: toolbar layout, popover, dropdown, summary cards.
- Mobile: condensed summary line, bottom sheet filters, card borders.

- [ ] **Step 3: Commit (if any fixes)**

```bash
git add -A
git commit -m "chore: verify disconnect UI redesign"
```

