# Disconnect (Rời mạng) UI Redesign Spec

Date: 2026-04-02
Owner: Codex
Status: Approved (chat, 2026-04-02)

## Goal
Make the “Rời mạng” (Disconnect) screen feel more premium and space-efficient on desktop and more readable on mobile, without changing core data logic.

## Scope
- `DisconnectPanelClean.tsx` layout, structure, and small render logic.
- `kpi.module.css` styling additions/adjustments used by Disconnect panel.
- No backend changes, no data model changes.

## Non-Goals
- No changes to import logic, permissions, or data calculations.
- No redesign of other prepaid views.

## User-Approved Direction
### Desktop
- Main toolbar is compact and split into two areas.
- Keep core filters visible: `Kỳ file`, `Tháng hủy`, `Nguồn`, `Thuê bao`.
- Advanced filters (`CTV`, `Quản lý`, and `Nguồn tải lên` for admin) move into a **popover** placed directly under a “Bộ lọc nâng cao” button.
- File-related actions are grouped under a **dropdown** “Thao tác ▾”.
- Summary cards stay in a single row but feel more premium; add a subtle ratio/progress indicator for overdue vs total.

### Mobile
- Show a single condensed filter status line “Đang áp dụng (n)” instead of many chips.
  - Detail text is optional and limited to one short summary string (max 32 chars, truncated with ellipsis).
  - Only include at most 2 fields in detail text: `Tháng hủy` and `Nguồn`. If either is absent, omit it.
- Filters open via a bottom sheet (existing collapsible panel is acceptable, styled as a sheet).
- Cards get stronger visual cues: colored left border and clearer status chips for `Đã tới ngày hủy` vs `Chưa tới ngày hủy`.

## UI Structure Changes
### Toolbar (Desktop)
- Left group: 4 primary filters.
- Right group: `Làm mới` button and `Thao tác ▾` dropdown.
- `Bộ lọc nâng cao ▾` button opens popover with advanced filters.

### Actions Dropdown
Entries:
- `Tải file mẫu` (admin only)
- `Tải file rời mạng` (admin only)

### Advanced Filters Popover
Contains:
- CTV (if allowed)
- Quản lý (admin only)
- Nguồn tải lên (admin only)
Notes:
- Permission gating must reuse existing flags/props in `DisconnectPanelClean.tsx` (no new permission logic).

### Summary Cards
- Retain 3 cards: Tổng thuê bao, Chưa tới ngày hủy, Đã tới ngày hủy.
- Add thin progress bar in Overdue card indicating `overdue / total` ratio.

### Mobile
- Replace chip list with a single line “Đang áp dụng (n)” with optional short text details (32 chars max).
- Use status-colored border on each mobile card (e.g. overdue = warm/red border).

## Styling Decisions
- Reduce heavy gradients, use subtle solid/dark-blue tint with thin borders.
- Keep typography consistent with existing KPI modules.
- Popover/dropdown adopt existing “glass panel” aesthetic.

## UX Behavior
- Popover opens below the trigger; click outside closes.
- Action dropdown closes on item click.
- Mobile bottom sheet is toggled by the filter button.

## Success Criteria
- Desktop toolbar height reduced by at least one row vs current layout.
- Advanced filters hidden unless explicitly opened.
- Mobile view shows a single filter summary line instead of multiple chips.
- Visual hierarchy improved for overdue items.

## Files to Change
- `src/app/(dashboard)/prepaid/DisconnectPanelClean.tsx`
- `src/app/(dashboard)/prepaid/kpi.module.css`

## Risks
- Popover/dropdown positioning on small desktop widths; test at ~1024px.
- Ensure focus/keyboard accessibility for popover and dropdown.

## Verification
- Manual: confirm toolbar layout on desktop, popover placement, dropdown behavior.
- Manual: confirm mobile filter summary and card borders.

