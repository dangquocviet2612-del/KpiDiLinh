# Sidebar Sáng/Tối Switch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hiển thị công tắc có nhãn Sáng/Tối ngay dưới Đổi mật khẩu, mặc định tối khi chưa có lựa chọn, lưu theme và phát hành bản đã kiểm chứng lên GitHub/Vercel Production.

**Architecture:** Giữ state và cơ chế `data-theme`/`localStorage` trong `Sidebar`, nhưng bỏ phụ thuộc `prefers-color-scheme` cho giá trị mặc định. Thay nút theme cũ bằng native button có `role="switch"`, CSS module riêng và test component cô lập theo từng vòng RED→GREEN.

**Tech Stack:** Next.js/React/TypeScript, CSS Modules, Lucide, Vitest, React Testing Library/user-event, GitHub CI, Vercel CLI.

**Release authorization:** Trong chat ngày 01/11/2026, sau khi duyệt kiểu công tắc, người dùng yêu cầu rõ “push vs deploy lên web”. Project chưa nối Git auto-deploy theo tài liệu hiện tại, nên push không được giả định tự phát hành; chỉ deploy CLI một candidate sau CI đạt.

---

## Cấu trúc file

- Create: `tests/ui/sidebar-theme-switch.test.tsx` — khởi tạo, vị trí, a11y, toggle, keyboard và persistence.
- Create: `tests/ui/sidebar-theme-switch-styles.test.ts` — policy source/CSS cho target và focus-visible.
- Modify: `src/components/Sidebar.tsx` — mặc định tối và markup switch.
- Modify: `src/components/Sidebar.module.css` — switch, target 44px và focus-visible.
- Include: `docs/superpowers/specs/2026-11-01-sidebar-theme-switch-design.md`.
- Include: `docs/superpowers/plans/2026-11-01-sidebar-theme-switch.md`.
- Modify: `tiendokpi.md` — checkpoint và bằng chứng phát hành.

## Test harness dùng chung

Mỗi test component mock `next/navigation`, `next-auth/react`, `window.matchMedia` và RAF. `beforeEach` xóa `localStorage`, gỡ `data-theme`, reset navigation/auth mocks, thiết lập `matchMedia`/RAF xác định và dùng real timers. `afterEach` chạy RTL cleanup, restore mocks/globals/timers, xóa storage và attribute để các case không phụ thuộc thứ tự.

### Task 1: Mặc định tối với RED→GREEN riêng

- [ ] Viết test cho saved `light`/`dark` và no-storage với `matchMedia` true/false; xác nhận `aria-checked` và `data-theme`.
- [ ] Chạy `npm.cmd test -- tests/ui/sidebar-theme-switch.test.tsx -t "defaults|restores"`; expected RED vì chưa có switch và code cũ chọn light khi system light.
- [ ] Sửa effect: chỉ nhận saved `light`/`dark`, còn lại chọn `dark`; set state + `data-theme`, không đọc `matchMedia` và không tự ghi storage cho mặc định.
- [ ] Thêm native button tối thiểu `type="button" role="switch" aria-label="Giao diện tối" aria-checked={theme === "dark"}` để test quan sát state.
- [ ] Chạy lại lệnh focused; expected GREEN cho bốn nhánh.

### Task 2: Vị trí liền kề, nhãn và semantics

- [ ] Viết test yêu cầu `passwordLink.nextElementSibling === themeSwitch`, `themeSwitch.nextElementSibling === logout`, và bên trong switch thấy đủ `Sáng`, `Tối`.
- [ ] Chạy `npm.cmd test -- tests/ui/sidebar-theme-switch.test.tsx -t "directly below"`; expected RED vì switch tối thiểu chưa có hai nhãn.
- [ ] Hoàn thiện markup: bên trái icon + `Giao diện`, bên phải track chứa hai span `Sáng`/`Tối` và thumb `aria-hidden`; giữ tên truy cập ổn định.
- [ ] Chạy lại focused test; expected GREEN.

### Task 3: Toggle bằng chuột/bàn phím và persistence

- [ ] Viết ba test độc lập cho click, Enter, Space. Mỗi test bắt đầu saved light, focus native button, kích hoạt đúng một lần bằng `userEvent`, rồi xác nhận false→true, `data-theme=dark`, `localStorage.theme=dark`, tên vẫn `Giao diện tối`.
- [ ] Chạy `npm.cmd test -- tests/ui/sidebar-theme-switch.test.tsx -t "toggles"`. Logic native cũ có thể đã PASS; nếu vậy ghi đây là characterization, không tạo RED giả. Nếu fail, chỉ sửa `toggleTheme` tối thiểu. Không thêm custom key handler.

### Task 4: CSS target/focus theo RED→GREEN

- [ ] Viết source-policy test đọc CSS và yêu cầu `.themeSwitch` có `min-height: 44px`, `.themeSwitch:focus-visible` có outline/box-shadow khác none, và checked selector làm thumb đổi vị trí.
- [ ] Chạy `npm.cmd test -- tests/ui/sidebar-theme-switch-styles.test.ts`; expected RED vì selector chưa có.
- [ ] Thêm CSS scoped cho row/track/labels/thumb/checked/focus, dùng token sidebar, không đổi `.navLink` toàn cục.
- [ ] Chạy `npm.cmd test -- tests/ui/sidebar-theme-switch-styles.test.ts tests/ui/sidebar-theme-switch.test.tsx`; expected GREEN.

### Task 5: Gate chất lượng local

- [ ] `npm.cmd test -- tests/ui/sidebar-theme-switch-styles.test.ts tests/ui/sidebar-theme-switch.test.tsx tests/ui/app-shell.test.tsx tests/ui/accessibility.test.tsx` — PASS.
- [ ] `npm.cmd test` — 0 fail, 0 unhandled error.
- [ ] `npm.cmd run test:performance` — PASS.
- [ ] `npx.cmd tsc --noEmit --incremental false` — exit 0.
- [ ] `npm.cmd run lint` — exit 0, không warning mới.
- [ ] `npm.cmd run build` — exit 0 với cấu hình local an toàn, không trỏ Production database.
- [ ] Review diff và `git status --short`; không env/database/backup/`.local`/credential trong stage.

### Task 6: Commit, push và CI

- [ ] Xác nhận `git branch --show-current` là `main`, `git remote get-url origin` là KpiDiLinh; khác thì dừng.
- [ ] Cập nhật `tiendokpi.md` bằng kết quả thực tế.
- [ ] Stage allowlist bằng `git add -- src/components/Sidebar.tsx src/components/Sidebar.module.css tests/ui/sidebar-theme-switch.test.tsx tests/ui/sidebar-theme-switch-styles.test.ts docs/superpowers/specs/2026-11-01-sidebar-theme-switch-design.md docs/superpowers/plans/2026-11-01-sidebar-theme-switch.md tiendokpi.md`.
- [ ] Kiểm tra `git diff --cached --name-only` đúng allowlist và `git diff --cached --check` sạch.
- [ ] `git commit -m "feat: restore sidebar theme switch"`; lưu SHA vào biến PowerShell tên riêng.
- [ ] `git push origin main`; `git ls-remote origin refs/heads/main` phải đúng SHA.
- [ ] `gh run list --commit <SHA>` rồi `gh run watch <RUN_ID> --exit-status`; chỉ deploy khi đúng SHA completed/success.
- [ ] Xác nhận `git rev-parse HEAD` đúng release SHA. Không deploy từ working tree đang phát triển: tạo fresh detached worktree ở thư mục release riêng đúng SHA, yêu cầu `git status --porcelain` rỗng trước khi chuẩn bị Vercel. Giữ credential smoke ngoài release root.

### Task 7: Candidate, smoke đăng nhập và Production

- [ ] Từ fresh release worktree, liên kết đúng Vercel project bằng metadata ignored do CLI tạo; không sao chép `.env`/database/credential vào root. Chạy dry-run/build manifest và kiểm file list/package exclusions: không có `.env`, `.local`, database, backup, worktree metadata, smoke credential hoặc file ngoài release SHA.
- [ ] `vercel inspect kpidi-linh.vercel.app` ghi deployment READY hiện tại làm rollback URL; nếu không xác định được thì dừng.
- [ ] Chạy `vercel deploy --prod --skip-domain` từ fresh verified release worktree; candidate phải READY và source SHA/hash trùng release SHA.
- [ ] Smoke candidate chưa đăng nhập: `/login` 200 và dashboard bảo vệ chuyển login.
- [ ] Smoke đăng nhập chỉ đọc bằng credential private ignored: switch nằm liền dưới Đổi mật khẩu; no-storage mở dark; đổi sang Sáng cập nhật `data-theme=light`, reload còn Sáng; đổi lại Tối và reload còn Tối. Không mutation nghiệp vụ.
- [ ] `vercel promote <candidate-url>`; inspect domain chính phải trỏ candidate/source đúng.
- [ ] Lặp smoke chưa đăng nhập và smoke switch đăng nhập trên domain chính. Nếu fail: `vercel promote <rollback-url>`, inspect alias trở lại rollback và lặp smoke login/protected-route.
- [ ] Cập nhật `tiendokpi.md` bằng SHA/CI/deployment/rollback/smoke, không credential; commit/push docs-only. Xác nhận project vẫn chưa auto-deploy trước docs push để tránh duplicate release.
