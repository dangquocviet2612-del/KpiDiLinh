# Đổi mật khẩu: pending state và kết quả chưa xác nhận

29/10/2026 — lát cắt local Task11, không đổi chính sách/backend hoặc bố cục/CSS, chưa publish.

## Vấn đề có bằng chứng

Form cũ chỉ disable nút, các ô vẫn sửa được khi PUT đang chờ; hai submit trong cùng batch có thể tạo hai mutation. Success cũ clear toàn bộ form bất kể JSON hợp lệ theo contract hay không, nên HTTP200 với null/object rỗng/error có thể báo thành công sai. Catch còn render thẳng exception.message, kể cả network/JSON parser details.

API hiện có trả HTTP200 với `{ message: "Đổi mật khẩu thành công" }` sau update, HTTP4xx với string error cho validation/auth và HTTP500 cho lỗi nội bộ. API/bcrypt/session không sửa trong checkpoint này.

## Hợp đồng form

| Tình huống | Request/field state | Phản hồi |
| --- | --- | --- |
| New password <6 hoặc confirm khác | Không fetch, không khóa guard | Giữ validation/copy hiện có |
| PUT pending | Guard đồng bộ, disable cả3field và nút, không nhận change events | aria-busy, tên nút Đang đổi mật khẩu |
| HTTP4xx + error string không rỗng | Release guard/loading, giữ các giá trị nhập | Giữ thông báo API để sửa lỗi |
| Network, non-JSON, 5xx, JSON sai shape, 201/202 | Release guard/loading, giữ fields, không auto-retry | Thông báo cố định về **kết quả chưa xác nhận**, nhắc kiểm tra đăng nhập trước khi gửi lại |
| Đúng HTTP200 + object/message string không rỗng, không error property | Release guard/loading, clear3field | Giữ copy Đổi mật khẩu thành công, role=status |

Không khẳng định server chưa đổi mật khẩu chỉ vì client nhận lỗi: request có thể đã commit trước khi mất phản hồi. UI không tự gửi lại; người dùng cần xác minh kết quả đăng nhập theo thông báo. Điều kiện success bám contract endpoint hiện tại, không phải hỗ trợ mọi phiên bản API tương lai.

PUT vẫn tới `/api/change-password`, Content-Type JSON và body chỉ gồm currentPassword/newPassword **verbatim**, không trim hoặc gửi confirmPassword. Giữ minLength6/required/confirm validation; không nâng/hạ password policy hoặc thêm logout/session-revocation behavior.

## Trợ năng và native fallback

- Labels nối đúng input id; autocomplete current-password/new-password/new-password, giữ type=password và name cũ.
- Message có id, role=alert cho lỗi hoặc role=status cho success; form busy/description phản ánh trạng thái, nút pending có accessible name. Không đổi palette/spacing/CSS hoặc thêm nút hiện mật khẩu.
- Form đặt method=post để tên/password không thành query URL GET nếu JavaScript không chạy. Đây chỉ là fallback privacy attribute, **không tạo native POST password-change flow**; API vẫn PUT và flow ứng dụng vẫn cần JavaScript. Không claim đã kiểm thử network/no-JS browser thực.

## Regression

`tests/ui/change-password-feedback.test.tsx`: React DOM thật, fetch mock và Response giả, không gọi API hoặc đổi password thật.

- RED đầu giữ riêng vì `it.each([])` spread làm một payload array thành undefined; sửa fixture thành object-wrapped rows trước khi sửa app. **Corrected RED23case:19fail/4pass → core GREEN23**. Failures kiểm UI labels, guard/pending fields và response/outcome, không missing module/setup.
- Bổ sung contract HTTP201/202: **RED2fail/23pass → final GREEN25/25**. Không skip, suppress, giảm assertion hoặc tăng timeout.
- Kiểm local validation/retry, pending editing/duplicate submit, masked inputs/attrs, success clear fields, known4xx, Error/string rejection, non-JSON200/502, 5xx details, non-string error, null/object/array/numeric/blank/inconsistent2xx, manual retry và exact PUT/verbatim body.
- Deferred requests được settle trong finally, mock trả Response riêng cho từng request để không tạo lỗi body-consumed giả. Broader QA và kết quả tích hợp ghi ở mục44 `tiendokpi.md`/private evidence.

**QA cuối:** Worktree và primary chạy riêng đều **40file/667scoped test +22policy đạt**, TypeScript nonincremental đạt, lint0error/3warning cũ. Không cộng hai lượt thành testcase khác nhau hoặc dùng focused/worker PASS thay primary. Static review độc lập APPROVE đúng pair sau, không tự chạy tests hay xác nhận backend mutation:

| File | SHA-256 |
| --- | --- |
| `src/app/(dashboard)/change-password/page.tsx` | `9581301ff5ef14a442821c449e3f73a4dad0c5f9b6bf44a38b56ef67b6dd4f00` |
| `tests/ui/change-password-feedback.test.tsx` | `0437024761f42ff97b1c4d73bce413f40678e78b3df3575189f469a31f97d72d` |

Source/docs integration có backup/hash/whitespace/default secret scan và inventory preservation riêng. API/server/CSS/tests có sẵn ngoài scope được đối chiếu snapshot; không có authored app/test edits sau freeze hoặc fresh build/browser acceptance.

## Giới hạn

1. Không request timeout/cancel: fetch/json chưa settle vẫn pending. Không bảo đảm server idempotency, concurrent writes/cross-tab, rollback mutation hoặc biết chắc trạng thái DB sau mất phản hồi.
2. Password policy6ký tự, backend auth/bcrypt, JWT/session/revocation vẫn là implementation cũ. Client guard không thay authorization/rate-limit hoặc invalidate token nơi khác.
3. Native form POST chỉ tránh fallback GET URL, không chứng nhận no-JS flow; autocomplete/ARIA là DOM attrs, không password-manager/screen-reader/mobile physical acceptance.
4. Không real auth/backend mutation E2E, build/browser/pixel/RUM hoặc Production acceptance. Iframe và các phần Task11/Task10 khác, native/KPI-timeout/oldvisual/Node0TB timing/release còn mở. Không publish.

Evidence private `.local/performance/change-password-feedback-20261029/`: snapshot/preimage, versioned RED/GREEN, frozen hashes, reviews/QA, backups/scans và manifests. Không commit env/DB/log/token hoặc credentials thật.
