# Web Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Giảm độ trễ chung khi tải dữ liệu trên các màn chính bằng tối ưu route/query dùng chung và cắt request client dư.

**Architecture:** Tối ưu theo ba lớp: cache TTL ngắn cho metadata/scope, giảm overfetch ở route GET, rồi giảm duplicate fetch ở client. Giữ thay đổi nhỏ, cục bộ, không đổi shape API hiện tại.

**Tech Stack:** Next.js App Router, Prisma + libsql/sqlite, SWR, TypeScript.

---

### Task 1: Cache dữ liệu người dùng và scope dùng chung

**Files:**
- Modify: `src/lib/scope.ts`
- Modify: `src/app/api/me/route.ts`
- Modify: `src/app/api/users/route.ts`
- Modify: `src/app/api/users/[id]/route.ts`

- [ ] Thêm cache TTL ngắn cho danh sách CTV accessible theo session role/name.
- [ ] Thêm cache TTL ngắn cho `/api/me`.
- [ ] Thêm cache TTL ngắn cho `/api/users` theo role filter và session scope.
- [ ] Thêm invalidation cho cache user khi tạo/sửa/xóa user.

### Task 2: Tối ưu route khách hàng và map

**Files:**
- Modify: `src/app/api/customers/route.ts`
- Modify: `src/app/api/customers/[id]/route.ts`
- Modify: `src/app/api/customers/bulk/route.ts`
- Modify: `src/app/api/import/route.ts`
- Modify: `src/app/api/customers/search-map/route.ts`
- Modify: `src/app/api/customers/map-data/route.ts`

- [ ] Chuyển `/api/customers` sang `select` tường minh thay vì tải full row.
- [ ] Thêm cache TTL ngắn cho danh sách khách hàng theo query string.
- [ ] Giảm kích thước candidate set ở `search-map` để giảm score/filter trong JS.
- [ ] Thêm invalidation prefix `customers:list` và `customers:search-map` ở create/update/delete/import.

### Task 3: Giảm duplicate fetch ở prepaid

**Files:**
- Modify: `src/app/(dashboard)/prepaid/page.tsx`

- [ ] Rà các `useEffect` hiện đang gọi lại cùng route khi state chỉ đổi gián tiếp.
- [ ] Giảm các refresh nối tiếp không cần thiết ở summary/manager summary.
- [ ] Giữ nguyên behavior UI nhưng tránh request lặp cùng params trong một nhịp.

### Task 4: Verify

**Files:**
- None

- [ ] Chạy `npm.cmd run -s lint -- --ignore-pattern tmp/edge-review/**`
- [ ] Chạy `npm.cmd run -s build`
- [ ] Kiểm tra nhanh các màn: `customers`, `map`, `node-map`, `prepaid`

