# Prepaid And Tools UI Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the prepaid UI into stable view components and make the tools module mobile-safe by moving from one tabbed iframe shell to separate tool screens.

**Architecture:** Keep business logic and fetching inside the prepaid page container, but move large view render branches into dedicated components. For tools, keep the existing asset app and switch it into single-view mode via query parameters, with Next route pages acting as launchers and wrappers.

**Tech Stack:** Next.js App Router, React client components, CSS modules, existing HTML/CSS/JS tool assets, TypeScript.

---

### Task 1: Set Up Prepaid View Boundaries

**Files:**
- Modify: `src/app/(dashboard)/prepaid/page.tsx`
- Create: `src/app/(dashboard)/prepaid/views/*.tsx`

- [ ] Identify the major `if (is...View)` render branches in `page.tsx`.
- [ ] Extract one branch at a time into a view component with explicit props.
- [ ] Keep fetching and mutations in `page.tsx`.
- [ ] Replace inline JSX branch with the extracted component call.
- [ ] Repeat until the large views are out of `page.tsx`.

### Task 2: Clean Visible Prepaid Text

**Files:**
- Modify: `src/app/(dashboard)/prepaid/page.tsx`
- Modify/Create: `src/app/(dashboard)/prepaid/views/*.tsx`

- [ ] As each view is extracted, rewrite visible mojibake strings in UTF-8.
- [ ] Prefer fixing strings in extracted views instead of touching unrelated logic.
- [ ] Leave non-visible comments for later if they do not affect UI.

### Task 3: Turn Tools Into A Launcher

**Files:**
- Modify: `src/app/(dashboard)/tools/page.tsx`
- Modify: `src/app/(dashboard)/tools/page.module.css`
- Create: `src/app/(dashboard)/tools/receipt/page.tsx`
- Create: `src/app/(dashboard)/tools/excel/page.tsx`
- Create: `src/app/(dashboard)/tools/photo/page.tsx`

- [ ] Replace the current single iframe `/tools` page with a launcher layout.
- [ ] Add three route pages that each embed only one tool view.
- [ ] Keep auth/role gating identical to the current tools page.

### Task 4: Add Single-View Tool Asset Mode

**Files:**
- Modify: `tool-assets/chia-file-son/index.html`
- Modify: `tool-assets/chia-file-son/script.js`
- Modify: `tool-assets/chia-file-son/style.css`
- Modify: `tool-assets/chia-file-son/sua-anh/index.html`
- Modify: `tool-assets/chia-file-son/sua-anh/style.css`

- [ ] Read `view`, `single`, and `embedded` from the query string.
- [ ] In single-view mode, hide shared top chrome and render only the requested tool.
- [ ] Make `receipt`, `excel`, and `photo` each mobile-first in single-view mode.
- [ ] Keep desktop behavior acceptable when opened directly.
- [ ] Bump asset cache versions.

### Task 5: Verify

**Files:**
- No code changes expected

- [ ] Run `npm.cmd run -s lint -- --ignore-pattern tmp/edge-review/**`
- [ ] Run `npm.cmd run -s build`
- [ ] Spot-check the major prepaid views and all three tools routes.
