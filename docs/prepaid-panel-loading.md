# Tải bundle giao diện báo cáo theo view — local 28/10/2026

**Checkpoint lịch sử của slice bundle:** Số liệu/observations dưới đây thuộc candidate bundle đã nghiệm thu trước bản sửa draft. Follow-up local `docs/kpi-calculator-drafts.md` và mục29 `tiendokpi.md` cập nhật chính sách giữ override cùng context sau refresh. Không sửa/ghi lại `preservedDraft:false` của baseline cũ thành true; không suy ra draft được lưu qua reload/unmount.

## Phạm vi

Slice đầu Task 8, không phải tách toàn bộ state/hook thành view containers. KPI cá nhân vẫn static. Mười panel UI còn lại dùng literal `next/dynamic` ở module scope trong `PrepaidPageImpl.tsx`, giữ SSR mặc định: calculator, summary, manager-summary, cước, cước CĐ, CDT, CDT summary, CDT outstanding, rời mạng và công văn.

Hook/data requests/state vẫn ở shell, giữ nguyên enabled gates, scope, ngày/CTV/manager, callback import và công thức. Không chờ code UI xong mới bắt đầu API, không dùng `ssr:false`, `preloadAll` hoặc preload panel chưa mở. Personal panel và shared CSS vẫn eager; hook ownership/CSS split là backlog.

## Loading và lỗi

- `PrepaidPanelLoading.tsx` dùng container/skeleton hiện có, `role=status`, accessible label và `aria-busy`; không đổi palette, toolbar hoặc layout panel khi đã tải.
- `prepaid/error.tsx` dùng AsyncState với nút **Tải lại trang**, cảnh báo mất bản nháp. Reset boundary đơn thuần có thể gặp lại promise module đã reject; full reload yêu cầu lại script theo URL hiện tại. Không hứa giữ draft qua lỗi code/reload.
- Không đổi dashboard/global error boundary hoặc API error/retry. Lỗi API vẫn do từng hook/panel xử lý như trước; boundary mới dành cho lỗi render/code của route prepaid.

## Bằng chứng

- `tests/ui/prepaid-view-loading.test.tsx` dùng real shell/hooks và installed dynamic loader, panel-module factories được đo evaluation/mount. Baseline static imports có **18 semantic evaluation failures**, không phải missing-module/import error. Sau sửa có **20 test mới**, toàn UI **192/192 qua 19 file**.
- Test pending loader kiểm tra API đã bắt đầu trước khi code calculator resolve, status skeleton, restricted view, back callbacks, manager/date/CTV và draft trong lúc reentry refresh đang chờ. Hai case recovery kiểm error UI/reload callback.
- Shell business body byte-identical; 18 UI file cũ và 461 assertions không sửa. Source key/SQL/cache/auth/API/schema/dependency không đổi.
- Baseline Chrome dùng build trước sửa, **34 ca**: ADMIN tất cả 11 view × desktop/mobile, MANAGER personal/calculator/summary/manager-summary × hai viewport, CTV personal/calculator × hai viewport. 1440×960 và 390×844/touch, fresh context mỗi ca; chỉ synthetic login/data, chặn business write.
- Trước sửa, mỗi ca tải **783.436 byte JS decoded /12 script responses**. Đếm response script của page, gồm shared runtime; không phải riêng byte module, compressed transfer, worker precache, p95 hoặc tốc độ mạng Production. API báo cáo và me/users được so status/count/body hash; settled UI so headings/buttons/text hash/overflow.
- Kết quả candidate/primary/build/browser sau sửa được ghi tại mục 28 `tiendokpi.md`. Evidence private `.local/performance/bundle-views-20261028/`, không đưa SQLite/env/cookie/credential/body nghiệp vụ vào Git.

## Kết quả browser candidate

- KPI cá nhân ở cả ba role/hai viewport: **783.436 →638.158 byte JS decoded**, giảm **145.278 byte /18,54%**. Số script responses tăng **12→14** vì chia chunk; không tuyên bố giảm số request JS hoặc nhanh hơn18,54% về thời gian.
- 34 ca sau sửa đạt, các view đo được638.158–659.169 byte JS. Status/count/body hash của các API báo cáo/me/users được theo dõi và settled headings/buttons/text hash/overflow khớp baseline. Không JavaScript error hoặc business write; fake SQLite không đổi.
- Client navigation personal→calculator với chunk UI giữ pending: personal không request chunk đó, API report đã **hoàn tất trước khi nhả chunk**, status loading accessible hiện rồi panel render. Đây là kiểm chứng compiled App Router thật, bổ sung cho installed dynamic loader trong Vitest.
- Chặn riêng chunk calculator hai lần làm route error hiện; **Tải lại trang** yêu cầu lại script thành công, giữ `view=kpi-calculator` và report hash khớp. Cảnh báo mất draft hiện rõ. Không chặn/đổi payload API để test qua.
- Browser Back sau sửa giữ ngày/CTV và reset settled draft đúng như baseline, không thêm mất draft do code loading. Native reliability vẫn chưa được giải quyết dù candidate test/build đạt.

## Giới hạn đã xác minh

1. **Limitation ở checkpoint bundle, được xử lý riêng:** native browser click sidebar rồi Back khi đó giữ ngày/CTV nhưng forced refresh normalize draft sau settlement. Test bundle chỉ chứng minh draft còn trong lúc pending, không chứng minh giữ sau settlement. Slice bundle không sửa hook/công thức; follow-up draft có test/evidence riêng tại `docs/kpi-calculator-drafts.md`, không dùng kết quả pending-only làm proof mới.
2. Baseline harness ban đầu coi mọi requestfailed là lỗi nên fail ở 21/26 Next RSC prefetch bị chủ động hủy. Diagnostic xác nhận `fetch`, không navigation, có `_rsc`, `net::ERR_ABORTED`, không phải script/API. Harness phân loại và ghi riêng, vẫn fail lỗi bất thường/API/script/navigation; log cũ giữ nguyên, không sửa app để chiều test.
3. Giữ log navigation baseline sai kỳ vọng draft cùng kết quả quan sát, không thay `preservedDraft:false` thành true. After phải đối chiếu behavior hiện có. Chưa test mọi role ở mọi domain, điện thoại thật, slow/offline hoặc service-worker lifecycle.
4. Chưa tách CSS, hook code/state còn eager; không kết luận hoàn thành Task 8 hay toàn roadmap. Không suy ra server-only dependency như XLSX là client cost nếu chưa có dependency graph chứng minh.
5. Native Windows/libsql gate, JWT/permission-version, invalidation nhiều instance/single-flight và nguyên nhân `/api/me` 500 trước đây vẫn chưa xử lý. Không đổi binding/pool hoặc retry native failure để ép xanh.

## Tiếp theo

Đo budget/CLS bằng mẫu lặp khi cần; tách hook/view owner từng domain sau khi có test state contract. Chính sách override khi reentry refresh được triển khai riêng, không gộp vào code splitting; xem `docs/kpi-calculator-drafts.md`. Không tự push/deploy.
