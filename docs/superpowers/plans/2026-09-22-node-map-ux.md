# Node Map UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Làm bản đồ node dễ hiểu hơn trên desktop/mobile, làm rõ bộ lọc và hoàn thiện accessibility mà không thay đổi nghiệp vụ dữ liệu.

**Architecture:** Giữ nguyên luồng API và Leaflet hiện tại. Tách các quy tắc UI thuần thành helper có unit test; mở rộng component kết quả tìm kiếm theo kiểu controlled active item; cập nhật `NodeMapComponent` và CSS để gom tác vụ phụ, hiển thị trạng thái lọc và bổ sung ký hiệu marker.

**Tech Stack:** Next.js App Router, React, TypeScript, React Leaflet, CSS Modules, Vitest, Testing Library.

---

### Task 1: Quy tắc lọc và marker

**Files:**
- Create: `src/lib/node-map-ui.ts`
- Create: `tests/unit/node-map-ui.test.ts`

- [x] Viết test cho tóm tắt bộ lọc, số lượng hiển thị và ký hiệu trạng thái.
- [x] Chạy test để xác nhận thất bại.
- [x] Viết helper tối thiểu và chạy lại test.

### Task 2: Tìm kiếm bằng bàn phím

**Files:**
- Modify: `src/components/MapSearchResults.tsx`
- Modify: `src/components/MapSearchResults.module.css`
- Modify: `tests/unit/map-search-results.test.ts`

- [x] Viết test active result và semantics listbox.
- [x] Thêm id, trạng thái active và callback hover/focus.
- [x] Chạy test mục tiêu.

### Task 3: Toolbar và bộ lọc

**Files:**
- Modify: `src/app/(dashboard)/node-map/NodeMapComponent.tsx`
- Modify: `src/app/(dashboard)/node-map/node-map.module.css`

- [x] Gom import/export/kiểu bản đồ vào menu Tùy chọn.
- [x] Thêm reset, số lượng `đang hiện/tổng` và gợi ý cuộn mobile.
- [x] Thêm điều hướng ↑/↓/Enter/Escape cho tìm kiếm.
- [x] Thêm ký hiệu marker và thông báo khi tự xóa lọc.

### Task 4: Mobile và motion

**Files:**
- Modify: `src/app/(dashboard)/node-map/node-map.module.css`

- [x] Đưa vùng bấm popup mobile lên tối thiểu 44px.
- [x] Thêm `prefers-reduced-motion` cho pulse và transition.
- [x] Kiểm tra panel và toolbar không tràn ở mobile.

### Task 5: Xác minh

**Files:**
- Test: `tests/unit/node-map-ui.test.ts`
- Test: `tests/unit/map-search-results.test.ts`

- [x] Chạy test mục tiêu và TypeScript.
- [x] Chạy toàn bộ test, lint và production build.
- [x] Kiểm tra `git diff --check` và tổng kết warning cũ.
