# Password visibility — local implementation plan

> **For agentic workers:** Continue the approved Task11 slice using executing-plans and test-driven-development; independent review before integration. No publication.

**Goal:** Người dùng chủ động hiện/ẩn mật khẩu ở Login và Đổi mật khẩu, mặc định che và tự che lại khi submit, giữ nguyên request/auth/validation.

**Architecture:** Component `PasswordInput` controlled, chỉ nối input hiện có với nút native44px và icon Eye/EyeOff đã có trong dependency. Mỗi page giữ visibility state; form handler che lại sau duplicate guard nhưng trước xử lý/validation. Không effect/timer/storage/copy/log password, không sửa backend.

**Tech Stack:** React/Next client components, TypeScript input attributes, Lucide có sẵn, CSS module/theme tokens, Vitest/RTL/user-event và auth/fetch/router giả.

## Thiết kế theo Task11

- Giữ nhãn/id/name/autocomplete/required/minLength/value/onChange/disabled và body request hiện tại. Mặc định `type=password`; từng ô đổi riêng, giữ nguyên giá trị kể cả khoảng trắng.
- Nút icon trong ô, `type=button`, nhãn Hiện/Ẩn theo từng ô, `aria-controls` trỏ đúng input và `aria-pressed`; native Tab/Space/Enter, focus-visible, vùng44px. Input chừa padding và chiều cao tối thiểu44px; không đổi bố cục ngoài field, global CSS hoặc palette.
- Khi submit (kể cả local validation failure) che lại; khi pending khóa cả input/nút, ref guard ngăn reveal từ click trong cùng batch. Error giữ values nhưng không tự hiện lại; success change-password vẫn clear3values, login vẫn giữ busy tới navigation như trước.
- Không auto-hide theo blur/timer hoặc persist lựa chọn giữa mount. Không thêm password strength/rules, reset password, session revoke hoặc sửa CTV modal trong đợt này. CTV đã có toggle riêng, giữ nguyên.

## Checklist

- [x] Rà Task11/forms/pattern CTV, hướng dẫn và Git/worktree; snapshot/preimage, giữ mọi thay đổi/evidence cũ.
- [x] Viết tests trước implementation, xác nhận RED do thiếu toggles chứ không import/setup failure.
- [x] Thêm component/CSS và nối2page; GREEN, kiểm request/validation/lifecycle, independent static review.
- [x] QA scoped tests/policy/types/lint riêng worktree và primary bằng env giả; không real auth/API/DB/full native suite.
- [x] Lưu guide/roadmap/tiến độ46; whitespace/default secret scan, snapshot/inventory/hash guards; không branch/commit/push/deploy.

## Files

- Modify `src/app/login/page.tsx`, `src/app/(dashboard)/change-password/page.tsx`.
- Create `src/components/PasswordInput.tsx`, `src/components/PasswordInput.module.css`, `tests/ui/password-visibility.test.tsx`.
- Docs `docs/password-visibility.md`, plan này, roadmap `2026-10-26-web-ux-performance.md`, `tiendokpi.md`.

## Verification

Focused synthetic runner `run.cjs worktree red` rồi `green`; giữ mọi artifact. Cùng selection41file/692test mục45 cộng test mới, policy22, `tsc --noEmit --incremental false`, `eslint src tests/ui/password-visibility.test.tsx`. Runner `envDir:false`, chặn env discovery và dùng mocks/fake credentials; không tăng deadline/skip/suppress hoặc dependency changes để ép xanh.

Kết quả: RED22fail→GREEN22; WT V1 types bắt option `exact:true` không hợp lệ, giữ sources/log/hash V1. Chỉ bỏ24option test dư (string names vốn match exact), không sửa app/assertion/matcher; GREEN V2 vẫn22/22. WT V2 và primary đạt riêng42file/714test+22policy/types, lint0error/3warning cũ; review APPROVE exact5hash V2. Chi tiết/identity/limits ở `docs/password-visibility.md`; không đóng toànTask11 hoặc release gates.

## Giới hạn

Hiện mật khẩu là lựa chọn làm plaintext nhìn thấy trên màn hình, không ngăn shoulder-surfing, extension, clipboard/DevTools hoặc script đọc value vốn có. Submit handler chỉ che khi JS handler thực sự chạy, không guarantee native-invalid submit không phát event, no-JS/autofill/password-manager/mobile/browser/screen-reader acceptance. Chưa measured CSS/CLS hoặc throughput/load benefit. Các native Windows/libsql, KPI timeout, visual/Node0TB timing và release gates cũ vẫn mở; không đóng toànTask11.
