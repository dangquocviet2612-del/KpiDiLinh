# Task 11: phản hồi lỗi đăng nhập, local

**Goal:** Lỗi signIn đã settle phải hiển thị thông báo, thoát loading để thử lại; không tự đẩy vào dashboard khi response không xác nhận thành công. Giữ bố cục/CSS, server auth, cookies/session và các menu đã ẩn.

**Architecture:** Client form bắt rejected signIn bằng try/catch/finally. Ref guard chặn hai submit đồng thời; failure release guard/loading, explicit ok=true và không error mới gọi push/refresh như trước, giữ busy trong lúc chuyển trang. Error là thông báo cố định không lộ exception/credentials, có role=alert và liên kết mô tả; thêm autocomplete phù hợp cho hai input.

**Tech Stack:** React/Next client component, Vitest/RTL jsdom. Mock signIn/router, không tài khoản/network/DB thật. Installed next-auth/react.js đã kiểm: redirect:false trả object có ok/error; cũng có path return undefined và tự điều hướng nội bộ SDK, không sửa SDK trong lát cắt này.

## Phạm vi

- Sửa `src/app/login/page.tsx`; thêm `tests/ui/login-feedback.test.tsx`.
- Thêm guide `docs/login-feedback.md`, plan này; cập nhật roadmap và mục43 `tiendokpi.md`.
- Không đổi palette/bố cục/CSS, backend credentials, role/permission, SessionProvider, dependency hoặc thêm nút hiện mật khẩu.

## Checklist

- [x] Snapshot437 paths/334 source-config-test paths/preimage/inventory/106 thay đổi local và hash565 artifact cũ, giữ HEAD/index và worktree hiện có.
- [x] RED14case trước code:13 assertion fail/1pass và3 unhandled rejections đúng lỗi cũ; rejected signIn, credential/invalid response, retry/stale error, concurrent submit, verified success busy, attrs và verbatim credentials. Không suppress failures hoặc tăng timeout.
- [x] Sửa tối thiểu, GREEN14/14 không unhandled; freeze source/test và review APPROVE exact pair. Không trim/mutate credentials, log password hoặc raw exception trong UI.
- [x] Worktree/primary chạy riêng mỗi nơi39file/642scoped test +22policy đạt, TypeScript nonincremental đạt, lint0error/3warning cũ. Không native full suite/retry unchanged code để ép xanh.
- [x] Source backup/hash/whitespace/default secret scan trước primary integration. `integrated-files.json` xác nhận docs/preservation cuối của tổng6file; mục43 ghi kết quả thật. Không commit/push/deploy hoặc đóng toàn Task11/release.

## Giới hạn

- Promise signIn chưa settle vẫn pending; không thêm timeout/cancel hoặc giả định SDK hủy được. Success giữ busy tới route unmount như trước; không chờ/đo route commit, không giải quyết router navigation im lặng bị treo.
- Chỉ ngăn own dashboard navigation khi response không xác nhận ok; SDK có thể tự redirect trước khi return undefined, không claim ngăn mọi redirect của SDK.
- Test browser DOM giả, không thay real auth/browser mobile/autofill/password-manager/latency acceptance. Live feedback/autocomplete là lát cắt nhỏ; UI và iframe tasks khác, native/KPI-timeout/oldvisual/Node0TB timing/release vẫn mở.
