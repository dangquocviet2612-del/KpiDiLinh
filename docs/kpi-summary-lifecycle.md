# Vòng tải Tổng hợp KPI và KPI quản lý — batch local 6

## Phạm vi

Tiếp tục phần lifecycle trong Task 5/đợt 2 của roadmap UX/performance, sau source `9d0365e`. Không thiết kế lại UI, không đổi công thức/rounding, SQL/API, schema, dependency hoặc phân quyền. Batch này chỉ local; không suy ra web online đã nhận source mới.

## Baseline đã xác minh

- Snapshot 380 file, 312 app/test/script/config file khớp byte giữa primary và checkout tách riêng. Checkout cũ vẫn có HEAD `1ecfa38`, không reset hoặc ghi đè công việc cũ.
- Ba test UI hiện có đạt 12/12 trước sửa.
- Chrome trên build trước sửa, cùng fixture riêng: ADMIN/MANAGER × desktop/mobile × summary/summary-manager, **8 case đều gọi report 4 lần khi mở**, refresh tường minh 1 lần, không JavaScript error. Đây là đếm request local, không phải phần trăm giảm thời gian hoặc p95 cloud.
- Fixture cũ của batch 3 không có ManagerKpiDailyResult nên không đủ bằng chứng cho `__all__`. Đã tạo database giả mới hoàn toàn có hai ngày/manager/metric để kiểm tra nhánh này; không sửa API hoặc nới expectation vì fixture thiếu data. Fixture/env/credentials không đưa vào Git.

## Thiết kế và acceptance

Tái sử dụng `useLatestKpiRequest` đang dùng cho personal/calculator; summary và manager-summary có resource owner riêng, key gồm scope id/name/role, ngày, quản lý và group. Không dùng identity của object session làm cache boundary.

1. Cùng pending key chỉ có một request; group/date server auto-resolve được nhận dạng thành alias đúng intent, không phát request thừa qua các nhịp debounce khác nhau.
2. Input đổi làm response cũ mất hiệu lực ngay, kể cả trong khoảng debounce trước khi request mới bắt đầu. Abort fetch khi không còn cần; không áp dụng success/error/settled cũ lên view mới.
3. Scope thay đổi phải reset dữ liệu/meta/error/key liên quan. Giữ rows khi refresh cùng scope, không giữ rows riêng tư qua tài khoản/role khác. Đây không phải JWT revocation ở server.
4. View ẩn không tải báo cáo. Mở lại view hoặc refresh/retry tường minh phải đọc lại, không bị key cũ chặn. Import vô hiệu hóa alias cần thiết, không fetch báo cáo panel ẩn hoặc ghi lại ngày import bằng response của ngày cũ.
5. Giữ manager `__all__`/allRows, selectedGroup của server, KPI âm/cước và thứ tự/totals hiện có. Personal/calculator phải tiếp tục qua regression trước đó.

## Verification

Regression permanent: `tests/ui/kpi-summary-lifecycle.test.tsx` (48 case), chỉ dùng synthetic payload/session/UI stubs. RED trên source gốc 32 fail/3 pass (35); boundary review có 1 fail/41 pass (42), sau sửa hidden manager import thiếu reportDate vẫn giữ latest intent. Spec review bắt thêm explicit-date ở personal/calculator chưa xóa intent đó: RED 2 fail/44 pass (46), sửa năm dòng callback chung và giữ automatic-resolution control. Quality review bắt calculator có thể reuse empty-date alias trước import: RED 1 fail/47 pass (48), thêm ba dòng local data-revision vào key calculator và tăng sau import thành công; active calculator tải latest, hidden không tải. Đây chỉ là generation dữ liệu client, không phải permission-version/server invalidation. Final targeted 62/62 qua năm file, giữ regression personal/calculator/panel cũ và cả hai P2.

Checkout đạt **57 file / 620 test + 22 policy test**, TypeScript/lint/build đạt; lint còn 3 warning cũ. Chrome 8 case ADMIN/MANAGER × desktop/mobile × hai view: report initial **4→1**, refresh 1→1, hash JSON initial/refresh giữ nguyên, manager `__all__` có data giả thật. Hai case ADMIN desktop có lỗi 503 giả → retry thành công và đổi ngày nhanh chỉ gửi ngày cuối; hai case history/back thực tế có đúng 1 request khi trở lại view. Không JavaScript error; schema/data fixture không đổi qua các GET/browser, hash file không đổi qua build.

Các kết quả tích hợp và xác minh primary được chốt ở mục 23 `tiendokpi.md`. Bằng chứng riêng tư: `.local/performance/batch6/`. Không coi mock auth client/HTTP fixtures là bằng chứng thu hồi quyền Production hoặc đo p95.

## Những việc chưa được giải quyết

- Shared `/api/me` query và server session hydration; chưa gom cache quyền client vô thời hạn.
- JWT/session/password revocation, stable permission-version, shared cache nhiều instance, server single-flight/in-flight refill (Task 7).
- Code splitting/view containers, DTO bản đồ, UI responsive, RUM/region/budget p50/p95 và các task tiếp theo.
- Một lượt `/api/me` HTTP 500 từng xuất hiện khi công bố batch 5 rồi không tái hiện ở shadow/final smoke. Không có bằng chứng nguyên nhân và không gọi client lifecycle là đã sửa lỗi đó. Batch 6 không truy cập Production để thử lại.

Không đánh dấu hoàn tất toàn Task 5 hoặc toàn đợt 2 chỉ vì slice này qua kiểm thử.
