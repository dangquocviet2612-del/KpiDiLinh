# Bản nháp Tính KPI theo context — local 28/10/2026

## Lỗi và chính sách sửa

Trước sửa, `useKpiCalculator.onSuccess` luôn normalize lại toàn bộ draft sau mỗi GET thành công. View reentry và nút **Làm mới từ KPI hiện tại** vẫn đọc dữ liệu mới đúng ý đồ, nhưng xóa các ô giả lập vừa sửa. Sáu ca Chrome ba role × desktop/mobile trên fixture giả đều tái hiện mất draft khi Back, Refresh và khi gõ trong lúc GET đang chờ.

Policy mới: **giữ các ô đã sửa trong cùng báo cáo, nhưng vẫn cập nhật số liệu gốc**. Nút **Khôi phục dữ liệu gốc** mới chủ động bỏ các override trong context hiện tại. Không tắt reentry/Refresh GET hoặc biến dữ liệu quyền thành client TTL.

## Context và vòng đời

| Tình huống | Hành vi |
|---|---|
| Chuyển giữa các view `/prepaid` rồi quay lại cùng ngày/CTV/scope | Giữ override cả sau khi refresh hoàn tất; ô chưa sửa theo default mới |
| Refresh cùng context hoặc gõ/step/đặt target trong lúc GET chờ | Latest manual override thắng khi response về |
| Reset trong lúc GET chờ | Xóa override; response sau đó dùng default mới, không khôi phục override cũ |
| Đổi ngày/CTV/scope/import revision, logout hoặc selection không khả dụng | Không mang draft/rows/totals cũ sang context mới; A→B→A không phục hồi draft A |
| Blank date ban đầu tự resolve sang ngày trả về | Giữ cùng context/alias, không fetch lại hoặc mất override chỉ do auto date |
| Latest date thực sự đổi, explicit date intent đổi hoặc chỉ tiêu bị bỏ | Bỏ override không còn thuộc báo cáo; chỉ tiêu thêm lấy default mới |
| Refresh lỗi trong context cũ | Giữ số liệu/draft đang có và báo lỗi theo flow cũ; không fallback data context khác |
| Reload, unmount route, logout hoặc recovery full reload sau lỗi chunk | Draft không lưu bền và có thể mất; cảnh báo reload hiện có vẫn đúng |

State chỉ giữ một context hiện hành (scope nhập từ session/import revision, CTV hiệu lực, requested/canonical date và owner token). Không có local/sessionStorage, DB draft hoặc map lịch sử theo mọi CTV/ngày.

## Reset và điểm số

- Chỉ ghi nhận ô được người dùng chỉnh qua typing/step/target, giữ raw text hợp lệ như0/rỗng/dấu thập phân. Không dựa vào `dirtyCount` để nhận biết override: sản lượng thay đổi nhưng điểm có thể đứng yên do cap/zero weight.
- Hook cung cấp `hasDraftEdits`; shell truyền vào optional prop cùng tên cho calculator panel để mở nút Reset khi có override. Standalone caller chưa truyền prop giữ fallback cũ. Không thêm nút, đổi layout/caption hoặc đổi cách tính `dirtyCount`.
- Công thức KPI, rounding/parser, tổng điểm và scoring cap không đổi. Snapshot defaults mới đi cùng override hợp lệ của context, không giữ mọi giá trị cũ làm dữ liệu gốc.

## Bằng chứng và kiểm thử

- Permanent regression: `tests/ui/kpi-calculator-drafts.test.tsx`, real hook/fetch lifecycle, raw inputs, update/reset races, context/alias/logout/ABA/pruning/StrictMode và reset reachability khi score delta bằng0.
- Baseline TDD46 semantic failures/10 controls pass; candidate đầu56 new test/248 all UI pass,19 UI file cũ không sửa. Kết quả candidate cuối, review, full QA và browser sau sửa theo mục29 `tiendokpi.md`; không dùng QA trước fix/review thay QA bản cuối.
- Spec review bắt P2: các mã chỉ tiêu hợp lệ `constructor`/`toString`/`hasOwnProperty` khiến map override rỗng đọc nhầm inherited function khi step. Sáu regression trước-edit/sau-Reset có6 fail/56 pass, sau dùng own-property lookup đạt62/62; không đổi parser hoặc công thức. Candidate R1/full QA trước P2 được giữ riêng, không thay bằng chứng candidate cuối.
- Baseline browser34 ca report/API/settled UI và6 ca draft ba role×hai viewport, build trước sửa được snapshot xác minh. Các API là fixture giả, chặn business write, chỉ lưu hash/metadata; không dùng database/env thật hoặc ghi password/cookie.
- Baseline Reset không khả dụng sau edit có zero score delta. Harness đầu chờ request rồi cố click disabled button gây timeout/unhandled waiter; giữ source/log gốc, sửa waiter và đo Reset unavailable đúng thực tế. Baseline ngày2000 vẫn có dòng default do query LEFT JOIN KpiMetricConfig; sửa kỳ vọng harness “zero rows”, không đổi API hay đánh dấu app lỗi vì test giả định sai.
- Private evidence: `.local/performance/calculator-drafts-20261028/`. Không commit log/SQLite/env/credentials/cookies hoặc payload nghiệp vụ.

## Giới hạn còn lại

Chỉ giữ draft trong cùng mounted shell/context, không phải tính năng lưu draft lâu dài. Không hứa chống mất draft khi đóng tab/reload/đi route làm unmount; không tự sync draft lên server hay gửi Zalo. Task8 view/hook/CSS extraction, Task7 permission-version/multi-instance/single-flight, native Windows/libsql reliability và nguyên nhân `/api/me`500 trước đây vẫn là backlog riêng. Không tự commit/push/deploy.

Tách view/hook sau này phải giữ owner hợp lệ qua các view trong mounted shell hoặc thiết kế state owner tương đương; không unmount calculator state cơ học rồi coi Task8 đã xong. Regression/browser reentry sau settlement phải tiếp tục bắt mất draft.
