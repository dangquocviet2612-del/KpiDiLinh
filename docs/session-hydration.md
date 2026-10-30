# Khởi tạo session dashboard từ server — batch local 7

## Phạm vi

Slice server hydration trong Task 5/đợt 2, nối tiếp batch 6 local chưa công bố. Dashboard dùng session từ lượt `auth()` đã có thay vì chờ client gọi lại session lúc mount. Không sửa `src/auth.ts`, API, SQL, schema, provider database, công thức hoặc quyền hiện có.

## Thiết kế

- Root layout giữ metadata, ngôn ngữ, Toaster và nội dung; không đọc auth ở global root. Login không cần useSession/confirm context nên vẫn có thể render static.
- Dashboard giữ auth/redirect server hiện tại, đặt Providers trong authenticated subtree và truyền dữ liệu session client hợp lệ. Không truyền token/password hay server-only dependency vào client.
- SessionProvider giữ defaults focus/revalidation/signout của thư viện; ConfirmDialogProvider vẫn bao toàn bộ các consumer đang có dưới dashboard.
- Provider key chỉ phụ thuộc identity id/name/role, không phụ thuộc expires hoặc object identity: subject đổi không dùng state cũ, renew session không làm mất draft chỉ vì expiry đổi.

## Baseline

Snapshot **383 file**, giữ 6 thay đổi batch 6 trên primary, **313 source/config/test file khớp** checkout. Chrome trước sửa với fixture giả: ADMIN/MANAGER/CTV × desktop/mobile đều có **2 GET session khi startup**, **1 GET khi phát visibility/focus event**, và **1 report request**. Cả schema/data fake không đổi.

Số 2 được đo thực tế, không lấy giả định 1: next-auth đang cài có `getSession()` phát sự kiện qua BroadcastChannel và SessionProvider lắng nghe storage/session event (`node_modules/next-auth/react.js`, functions getSession/SessionProvider). Đây là request count của lab hiện tại, không phải SLA hoặc thời gian cloud.

## Kiểm chứng

- Regression `tests/ui/session-hydration.test.tsx`: source gốc **18 fail/2 pass**, sau sửa **20/20 đạt**; SessionProvider/useSession/signIn/signOut thật, chỉ mock browser/network/server boundary và UI không liên quan. Có test reset identity, expiry giữ draft, allowlist serialization, confirm context, login không cần provider, focus/explicit/cross-tab revalidation.
- Checkout đạt **58 file / 640 test + 22 policy test**, TypeScript/build đạt; lint 0 error và 3 warning có sẵn (`canUseGps`, `skippedRows`, `readSheetObjectRows`). Build bằng fixture riêng, `/login` vẫn static. Spec và quality review độc lập đều duyệt bốn hash frozen.
- Chrome ADMIN/MANAGER/CTV × desktop/mobile: **startup GET session 2→0**, report vẫn **1 request**, hash JSON trước/sau khớp. Focus vẫn revalidate đúng role; lượt cuối quan sát **2 request/focus** do getSession phát BroadcastChannel và storage listener gọi lại. Giữ nguyên SDK defaults, không tắt broadcast hoặc refetch để làm đẹp số đo.
- Baseline ghi nhận 1 focus request với cửa sổ quan sát cũ; harness sau sửa chờ thêm 200ms rồi network-idle để nhận broadcast follow-up. **Không dùng hai số focus này để kết luận cải thiện hoặc regression**; chỉ so startup count/report payload trên cùng fixture. Log các lần harness sai kỳ vọng focus, nhãn nút mobile và chờ URL `/` tạm thời vẫn được giữ; mã app không đổi để chiều test. Root thực tế redirect `/customers`; smoke cũng tuân thủ cửa sổ rate-limit login hiện có.
- DOM login/logout ADMIN/MANAGER/CTV, anonymous redirect trước/sau logout, sai mật khẩu ADMIN và mở modal khách hàng desktop/mobile đều đạt; không JavaScript error hoặc submit nghiệp vụ, schema/data fake không đổi. Test confirm dialog còn có regression ở sidebar và main. Kết quả tích hợp/full primary ghi tại mục 24 `tiendokpi.md`.

Bằng chứng riêng tư: `.local/performance/batch7/`; không commit env, cookies, token, password hoặc SQLite. Dữ liệu/tài khoản dùng trong browser đều từ fixture fake đã quản lý.

## Giới hạn

- **Shared `/api/me` chưa làm.** Customers, modal và KPI vẫn dùng các caller hiện tại; GPS và CTV list không được gộp tùy tiện hoặc cache quyền vô hạn.
- Không có JWT revocation, subject DB revalidation, permission version hoặc multi-instance invalidation mới; vẫn còn các gap Task 7 trong `docs/cache-permission-gaps.md`.
- Không xử lý nguyên nhân `/api/me` 500 từng quan sát trong rollout batch 5. Batch này không truy cập Production hoặc đổi cách tính KPI.
- Không hoàn tất toàn Task 5/đợt 2, không đo p95/region/bundle/Core Web Vitals. Batch 6 và 7 chưa push/deploy; release đã công bố gần nhất là `9d0365e`.
