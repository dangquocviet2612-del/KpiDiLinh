# Hiện/ẩn mật khẩu ở đăng nhập và đổi mật khẩu

## Phạm vi

Mục tiến độ46, ngày29/10/2026, tiếp phần hiện mật khẩu trong Task11 đã duyệt. Bổ sung một thao tác nhỏ tại4ô mật khẩu: Login, mật khẩu hiện tại, mật khẩu mới và xác nhận mật khẩu mới. Không đổi màu/bố cục tổng thể, nghiệp vụ, API, policy, quyền hoặc nội dung CTV/công cụ khác.

## Hành vi

| Tình huống | Kết quả |
| --- | --- |
| Vừa mở/mount lại trang | Mọi ô mật khẩu che mặc định, không lưu lựa chọn hiện trước đó |
| Bấm biểu tượng mắt | Chỉ ô được chọn đổi giữa password/text; giá trị, khoảng trắng, nhãn và autocomplete giữ nguyên |
| Tab/Space/Enter tại nút | Dùng hành vi nút native; không gọi submit/signIn/PUT chỉ vì hiện/ẩn |
| Submit handler bắt đầu | Che lại trước xử lý; với Đổi mật khẩu áp dụng cả lỗi local min6/confirmation |
| Request đang chờ hoặc login đã xác nhận và đang điều hướng | Khóa cả input/nút; ref guard chặn toggle đã queue trong cùng submit batch |
| Lỗi đã settle | Mở lại control, giữ values nhưng vẫn che; người dùng có thể chủ động hiện lại |
| Đổi mật khẩu thành công theo contract hiện có | Clear3values và giữ che; không dùng toggle thay xác minh response |

Che lại xảy ra khi JS submit handler chạy. Browser native validation có thể ngăn submit event từ đầu; không tuyên bố luôn che sau mọi lần bấm nút submit, sau mất focus hoặc sau một khoảng thời gian.

## Cấu trúc và giới hạn thay đổi

- `src/components/PasswordInput.tsx` là component controlled: không giữ bản sao mật khẩu/visibility state, không effect/timer/ref/storage/network. Nó chỉ chuyển type, render Eye/EyeOff và forward input attributes.
- Hai page sở hữu visibility state trong bộ nhớ của mount. `id`, `name` hiện có, labels, value/onChange, disabled, required, minLength, autocomplete và native form method không thay đổi. Không trim hoặc thêm tên field cho Login.
- Nút native `type=button`, tên Hiện/Ẩn tiếng Việt theo từng field, `aria-controls`/`aria-pressed`, icon ẩn khỏi accessibility tree. Dùng Tab/Space/Enter sẵn có, không thêm shortcut hoặc can thiệp clipboard.
- CSS module giữ theme tokens và style input-base; thêm padding để chữ không nằm dưới nút. Vùng nút44×44px, input tối thiểu44px, focus-visible. Chiều cao field có thể tăng để đủ vùng chạm; chưa đo layout/CLS/mobile/pixel thực.
- Login vẫn `signIn(credentials,{username,password,redirect:false})` verbatim, cùng response/error handling và busy-until-navigation. Đổi mật khẩu vẫn local min6/confirm, PUT2fieldcurrent/new, strict HTTP200/message/no-error và unknown-outcome feedback. Backend/auth/hash/session/JWT và các tests có sẵn không sửa.
- Không thay CTV modal đã có toggle riêng; không khôi phục3menu đã bỏ.

## Kiểm thử và evidence

`tests/ui/password-visibility.test.tsx` thêm22case (8Login,14Đổi mật khẩu), React DOM/user-event thật, auth/router/fetch giả và credentials tổng hợp.

- **RED22/22fail** trên hai form cũ do thiếu controls; không import/setup hoặc unhandled error failure. Sau implementation **GREEN22/22pass**, không skip/suppress/deadline hoặc config/dependency changes.
- QA V1 đạt42file/714test+22policy/lint nhưng TypeScript bắt option `exact:true` không thuộc `getByRole`/ByRoleOptions của thư viện cài sẵn. Giữ toàn bộ source/log/hash V1; V2 chỉ bỏ24option không hợp lệ, string name vẫn match exact mặc định theo implementation `role.js`/`matches()`. Không đổi app, assertion, name matcher hoặc thêm type suppression; focused V2 vẫn22/22pass. Kết quả QA V2 ghi riêng, không dùng V1 test PASS che lỗi types.
- Bao phủ masked default/attrs, từng ô independent, value/name/onChange, exact request body/credentials, native keyboard control không submit, pending ref/batch guard, known/error/uncertain feedback, validation, confirmed success và remount.
- Các tests không gọi auth/API/DB thật, không tải web hoặc chứng minh password manager hoạt động ngoài browser. CSS dimensions là quy định trong source, không phải đo pixel bằng jsdom.
- **Worktree V2 và primary chạy riêng đều đạt42file/714scoped test +22policy**, full TypeScript nonincremental đạt, ESLint0error/3warning cũ. Không cộng hai lượt, gọi selection là full suite hoặc dùng V1/focused/reviewer PASS thay type-check và primary QA. Native SQLite experimental warning của fixture có sẵn không phải test failure.
- Review static độc lập APPROVE spec trước quality cho exact5file V2; reviewer tự đối chiếu preimage, hashes và24query corrections, không chạy tests/browser hoặc xác nhận QA rộng. Không sửa app/test sau freeze V2.
- Source integration có backup/preimage, whitespace/default secret scan không finding;9ownedfile gồm5source/test và4docs. Manifests/final-check kiểm448snapshot paths, inventories,120thay đổi cũ và681artifact cũ; guards/asset/API/menu/CTV và tests có sẵn khác không đổi. V1 sources/logs/hash/type failure vẫn giữ, V2-correction manifest chứng minh không thay app/assertion/matcher. Không branch/commit/push/deploy.

### Candidate identity

| File | SHA256 |
| --- | --- |
| `src/app/login/page.tsx` | `a32eacce0bf7c6eb1f749e033a951f7538134e2d4320eac22ac278988154c6bf` |
| `src/app/(dashboard)/change-password/page.tsx` | `ce68ac64a29c59cd0767de7968f7fb6d67d2b1750cfda15c4cdececfdbb03f7c` |
| `src/components/PasswordInput.tsx` | `95524b9c4a3d92663e3a44d0d4a5bced3473551964c0d9fd8dd260cd06a68ea1` |
| `src/components/PasswordInput.module.css` | `5e80dc5404568fd5628d17602a001f160e2d89472b4e8a3ddda584e33810cfed` |
| `tests/ui/password-visibility.test.tsx` (V2) | `c407ac061fba4caa40032162f8d6f0d90bc575f4d3bddb2b152efb78cadd2b9a` |

Evidence private `.local/performance/password-visibility-20261029/`: snapshot/preimage, RED/GREEN, source hashes/review, QA/scans/backups/manifests. Không đưa env, DB, token hoặc dữ liệu kinh doanh vào Git.

## Chưa nghiệm thu

1. Không bảo vệ khỏi người nhìn màn hình, extension, script hay DevTools; input value vốn vẫn có trong DOM/state kể cả type=password. Không log/persist/copy password, không gọi hiện mật khẩu là mã hóa hoặc tăng bảo mật backend.
2. Việc đổi type có thể tương tác khác giữa browser/OS/autofill/password manager; chưa test browser thật, IME/caret/selection/mobile hoặc screen reader. Existing values/attrs được kiểm tại DOM, không guarantee autofill.
3. Không auto-hide trên blur/tab nền/timer; cần chọn Ẩn hoặc submit handler chạy. Native-invalid/no-JS submit, route commit/cross-tab/session revocation chưa nằm trong acceptance.
4. Không đo tốc độ tải, JS bundle, CSS/CLS/contrast hoặc performance Production. Không native Windows/libsql full-suite, build, dependency upgrade, commit/push/deploy; KPI timeout/visual/Node0TB timing và các release gate cũ vẫn mở.
5. Lát cắt này không hoàn tất toànTask11/Task10. Mixed checkbox Login/iframe vẫn giữ mở vì có request chưa settle/hydration/browser/mobile và acceptance khác chưa nghiệm thu.

Plan: `docs/superpowers/plans/2026-10-29-password-visibility-local.md`.
