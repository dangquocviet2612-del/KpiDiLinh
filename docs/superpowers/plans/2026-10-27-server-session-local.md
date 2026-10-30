# Server session hydration — local batch 7

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Preserve batch 6 local edits; no commit/push/deploy.

**Goal:** Tiếp tục phần server hydration của Task 5: dashboard đã xác thực dùng ngay session server đang có, không chờ GET session ban đầu và không làm login thành route dynamic.

**Architecture:** DashboardLayout giữ `auth()` và redirect `/login` hiện có, chuyển client Providers xuống trong authenticated layout và truyền session đã xác minh. RootLayout bỏ wrapper này, giữ nguyên metadata/lang/Toaster/children; login hiện chỉ dùng signIn nên không cần useSession/confirm context. Providers nhận session tường minh, giữ defaults refresh/focus/signout của SessionProvider và ConfirmDialogProvider. Key dashboard provider theo id/name/role để không giữ client state của identity cũ khi server session đổi, không key theo expires/object identity. Chỉ truyền trường session client hợp lệ (expires và user id/name/role/email/image), không pass token/password hoặc server-only Prisma/auth module vào client.

**Scope:** `src/components/Providers.tsx`, `src/app/layout.tsx`, `src/app/(dashboard)/layout.tsx`, new `tests/ui/session-hydration.test.tsx`; không sửa `src/auth.ts`, API, schema, dependency, formula hoặc cache server. Shared `/api/me` query là slice riêng vì caller GPS/CTV có semantics khác nhau; Task 5 chưa hoàn tất.

**Guardrails:** Primary còn 6 thay đổi batch 6 được giữ nguyên. Snapshot và hash-check source ở checkout đang dùng; không reset HEAD cũ, không tạo branch/commit. Chỉ fixture synthetic đã quản lý ở localhost3006, không env/credentials/database thật, không Turso/Vercel. Không coi hydration hoặc client identity reset là JWT/session revocation. Sự cố `/api/me` 500 trước đây chưa được sửa bởi batch này.

- [x] Snapshot 383 file (bao gồm batch6 local), 313 source khớp; login không dùng session/confirm context, consumers còn lại đều dưới dashboard. Chrome6case baseline đều có 2 startup session requests, 1 focus request và 1 report request.
- [x] TDD RED trên source gốc: 18 fail/2 pass; GREEN 20/20 với SessionProvider thật, gồm SSR/no-startup-fetch, auth/redirect, focus/explicit/cross-tab refresh, identity reset/expiry giữ draft, safe client fields, confirm/login boundary.
- [x] Implementation nhỏ ba app files, GREEN targeted và 129 regression qua 22 file, giữ session provider defaults và mọi local change trước đó.
- [x] Spec review rồi quality review độc lập đều APPROVE trên bốn hash frozen, không có actionable finding. Review không thay thế browser gate.
- [x] Full checkout 640 test + 22 policy, types/lint/build đạt (3 warning cũ); login static. Chrome 6 case startup session 2→0, report 1→1/hash khớp; focus revalidate đúng role (2 request SDK broadcast), modal desktop/mobile và DOM login/logout ba role đạt, fake database không đổi.
- [x] Tích hợp đúng 8 file sau hash/backup/secret scan, giữ batch 6; primary đạt 640 test + 22 policy, types/lint đạt (3 warning cũ). Cập nhật tiến độ/roadmap, giữ local không commit/push/deploy. Đối chiếu byte với checkout đã build và kiểm tra cuối bằng `integration-verification.json` riêng tư.

**Acceptance:** Bỏ round-trip session client ban đầu trên dashboard, không bỏ xác thực server hoặc revalidation/focus defaults. Không globalize server session, không cache quyền vô thời hạn, không mất client state khi chỉ renew expiry. Các mục shared `/api/me`, permission/JWT và multi-instance vẫn pending.
