# Đăng nhập: phản hồi lỗi và quyền sở hữu request

29/10/2026 — lát cắt local Task11, không đổi bố cục/CSS, chưa publish.

## Lỗi đã tái hiện

- `signIn` reject khiến handler cũ bỏ qua nhánh reset loading, không hiển thị lỗi và phát sinh unhandled rejection; form tiếp tục bị khóa.
- Response undefined hoặc `ok:false` không kèm `error` vẫn bị handler cũ coi là thành công và gọi push dashboard.
- Hai submit tới trước khi React cập nhật disabled có thể tạo hai request. Disabled UI không phải khóa đồng bộ cho handler.

Test trang React thật với signIn/router giả: **RED13 assertion fail/1pass và3 unhandled rejections** của bản cũ, không nuốt hoặc suppress chúng; **GREEN14/14**, không unhandled errors. Ba exception cũ gồm hai rejected signIn và một lỗi navigation đồng bộ. Không phải lỗi import/setup hoặc thử bằng tài khoản thật.

## Hợp đồng mới

| Trạng thái | Form/request | Phản hồi |
| --- | --- | --- |
| Chưa submit | Input/button hoạt động | Labels/mật khẩu che như trước, autocomplete username/current-password |
| Đang chờ signIn | Ref guard chặn submit lặp, fields/button disabled, aria-busy | Giữ chữ Đang xử lý hiện có |
| Response có error | Release guard/loading, giữ nguyên giá trị nhập | Giữ thông báo Sai tài khoản hoặc mật khẩu cũ |
| Reject hoặc response không xác nhận ok=true | Release guard/loading để retry, không own dashboard push | Thông báo cố định, không đưa raw exception/credentials vào UI |
| ok=true, không error, push/refresh thành công đồng bộ | Giữ busy/guard tới navigation như trước | Chỉ gọi push("/") và refresh một lần |

Exception đồng bộ của push/refresh cũng đi qua catch/finally và mở lại form; không có cơ chế rollback session/cancel route. Khi retry, thông báo cũ được xóa trước await; username/password không bị trim, reset hoặc đổi chữ hoa/thường. `redirect:false` giữ nguyên.

Error region có `role=alert`, id ổn định, form mô tả qua `aria-describedby` khi có lỗi. Thêm autocomplete và tắt autocapitalize cho username; không thêm input name hay thay native form submission, không thêm nút hiện mật khẩu. Đây là markup hỗ trợ accessibility/autofill, không chứng nhận mọi screen reader hoặc password manager.

## Phạm vi và evidence

- App: `src/app/login/page.tsx`; regression: `tests/ui/login-feedback.test.tsx`.
- Không sửa server auth, credentials provider, role/permission, cookies/session/SessionProvider, schema/API, dependency, CSS hoặc các menu đã bỏ.
- Installed `next-auth/react.js` đã đọc trực tiếp: redirect:false có response ok/error, một số path return undefined và tự redirect trong SDK. Check này chỉ ngăn dashboard push do component, **không ngăn redirect bên trong SDK**.
- 14case kiểm pending/duplicate/credential error/network reject kiểu Error và string/3 unconfirmed responses/success lock/error precedence/retry/error clearing/verbatim credentials/sync navigation failure/autocomplete và busy/alert attrs.
- Broader QA/review/primary integration ghi tại mục43 `tiendokpi.md` và private evidence, không dùng focused PASS thay primary hoặc full suite.

**QA cuối:** Worktree và primary chạy riêng, mỗi nơi **39file/642scoped test +22policy đạt**, TypeScript nonincremental đạt, lint0error/3warning có sẵn. Không cộng hai lượt thành testcase khác nhau. Review static độc lập APPROVE đúng pair:

| File | SHA-256 |
| --- | --- |
| `src/app/login/page.tsx` | `d513ace8784e94a4fb62cd8b6808d6a92296fec58af20a1844d06a36cb643581` |
| `tests/ui/login-feedback.test.tsx` | `9934717e7fdd633d0d5963467eb981338f67f932a6ca424ad1c1644f691cc405` |

Review không tự chạy tests hoặc xác nhận auth/browser thật; parent QA và source/docs manifests là bằng chứng thực thi/tích hợp. CSS/server/API và tests có sẵn không thuộc owned files được đối chiếu hash với snapshot; không thêm config/dependency/timeout.

## Giới hạn còn mở

1. **Không thêm request deadline:** signIn chưa settle vẫn pending; không cancel được request/late SDK side effects bằng thay đổi này. Lỗi đã settle mới release form.
2. **Không chờ route commit:** success vẫn khóa như cũ trong lúc chuyển trang; navigation im lặng bị treo, browser back/cache/unmount và cross-tab behavior cần phép thử riêng.
3. `res.error` vẫn dùng copy lỗi credential cũ, chưa phân loại mọi provider/configuration error. Client guard không thay backend session validation và không phải thêm biện pháp phân quyền.
4. Test mock auth/router, không real sign-in, browser offline/E2E, mobile physical, password-manager hoặc screen-reader acceptance. Không sửa CSS/palette nên không có yêu cầu preview thiết kế mới, nhưng chưa khẳng định pixel/layout equivalence.
5. Full-native Windows, timeout KPI cũ, strictvisual/Node0TB timing, iframe/loading/hiện mật khẩu và các phần Task11 khác vẫn mở. Không fresh build/browser/Production latency claim, dependency upgrade hoặc commit/push/deploy.

Evidence private `.local/performance/login-feedback-20261029/`: snapshot/preimage, RED/GREEN, frozen hashes, reviews/QA, scans/backups và integration manifests. Chỉ fake credentials; không commit env/DB/log/token.
