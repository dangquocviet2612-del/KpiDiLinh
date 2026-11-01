# Tinh gọn CD/FTTH, Tổng hợp KPI và card khách hàng

Checkpoint **79 — 01/11/2026**. Owner duyệt ba thay đổi UI local sau review; chưa yêu cầu push/deploy đợt này. Giữ palette, công thức, phân quyền, payload/API và dữ liệu. Không đổi bản đồ hoặc các menu.

## Thay đổi

| Khu vực | Hành vi mới | Giữ nguyên |
| --- | --- | --- |
| Cước CD/FTTH | ADMIN thấy status có tên “Trạng thái tỷ lệ giao” với nội dung “Tỷ lệ chưa lưu”. Không dùng draft tỷ lệ để hiển thị “Bộ lọc (1)”. Nút Lưu giữ tên truy cập và busy state cả khi hiện spinner. | Hai dịch vụ vẫn dùng chung panel nhưng endpoint/data/rate riêng; điều kiện save/disabled, callback và quyền sửa không đổi. |
| Tổng hợp KPI mobile | Ngày và nút “Bộ lọc khác” ở phần đầu; chỉ tiêu, lọc chưa đạt và counts luôn ở ngoài disclosure. Quản lý/làm mới là phần phụ có thể mở; manager đang lọc vẫn có nhãn riêng khi thu gọn. | Chỉ thêm UI state/useId; không fetch/reset context khi mở/đóng. Desktop giữ thứ tự và các trường cũ. Không đổi logic sắp xếp hoặc tính KPI. |
| Card khách hàng mobile | Bỏ khung nền/viền lồng nhau của phone/account/package, giữ từng nhóm thông tin. ADMIN mở menu dấu ba chấm để Xóa; menu mở lên trên, mục bấm tối thiểu 44px. | Phone/Zalo/copy, dữ liệu đầy đủ/thiếu, chọn/Sửa/Xem node và callback Xóa đúng id giữ nguyên. Desktop vẫn có nút Xóa như cũ; MANAGER/CTV không có menu phá hủy. Không thay xác nhận xóa ở caller/API. |

Nguồn: `src/app/(dashboard)/prepaid/CuocCdPanelClean.tsx`, `SummaryKpiPanelClean.tsx`, `kpi.module.css`, `src/components/CustomerTableRefined.tsx`, `src/app/(dashboard)/customers/customers.module.css`.

## Bàn phím và responsive

- Disclosure dùng button non-submit, `aria-expanded`, `aria-controls` riêng cho từng instance. CSS chỉ thu gọn ở mobile; không đặt `aria-hidden` làm mất trường desktop.
- DOM giữ thứ tự hiển thị: trigger trước các trường được mở, Enter rồi Tab đến quản lý → làm mới → chỉ tiêu. Không dùng CSS order để đảo ngược thứ tự focus.
- Reuse `ActionMenu` hiện có: tên thao tác theo khách hàng, Escape trả focus, click ngoài đóng, bấm Xóa mới gọi callback. Không tự thực hiện DELETE trong component.
- Kiểm tra fixture 360/390/768/1024/1440px theo các case đã định, light/dark và chữ 200%; không đồng nghĩa nghiệm thu mọi tổ hợp hoặc thiết bị thật.

## Bằng chứng local

- Snapshot 552 public paths, giữ ba thay đổi tài liệu của mục 78; bản sao test không có env/database/backup. Không sử dụng worktree chứa candidate68 để tích hợp.
- TDD ban đầu: 7 file/96 case, 16 fail có chủ đích trước sửa; giữ raw evidence. Regression bàn phím sau review: 97 case/1 fail → sau sửa **97/97 đạt**, không unhandled errors.
- Cập nhật bốn test customer cũ sang hợp đồng mở menu trước Xóa, giữ case về role/id/callback/non-submit và các trường còn lại. Thêm 16 case trong `tests/ui/report-customer-polish.test.tsx`; không bỏ case, skip hoặc đổi timeout/pool/config.
- Lượt candidate cuối: **95 file/1.671 case unit/UI đạt**, types và lint 0 warning, canonical `next build` đạt trên output riêng với credential/database giả. Chỉ có cảnh báo Turbopack suy luận workspace root của bản sao; không sửa config để che cảnh báo.
- Chrome fixture cuối: **24 ảnh trước/sau, 26 kiểm tra tương tác đạt**, không page errors hay request external/API. Sáu cặp desktop ở 1440px (summary/customer/FTTH × light/dark, trạng thái đầu) PNG giống nhau.
- Trên fixture 390px: toolbar summary **324,59 → 237px**; card khách hàng **397,64 → 349,36px**, cả light/dark. Đây là chiều cao bố cục với dữ liệu giả, **không phải phần trăm tăng tốc web hoặc chiều cao mọi dữ liệu thực**.
- Giữ các lượt chưa đạt: runner label exact không match select được sửa bằng locator có kiểm tra tồn tại; Chrome phát hiện toggle mobile bị shared class làm hiện trên desktop và mục Xóa 40px. Sửa CSS trong phạm vi summary/menu để đạt desktop strict visual và 44px, không nới tiêu chí.

Independent review đã yêu cầu sửa thứ tự Tab rồi duyệt lại source/test theo hash. Kết quả primary integration chỉ được xác nhận bằng `final-scope.json` sau khi guard kiểm tra đầy đủ, không suy từ việc checklist này có mặt.

## Giới hạn và bước tiếp theo

- Fixture render component bằng Vite/Chrome, không phải đăng nhập Next app hoặc nghiệm thu nghiệp vụ ba role trên database staging. Kiểm tra nonadmin ở đây là presentation/props, không thay test authorization server.
- Không chạy native integration Windows đã biết vấn đề; không đóng gate auth/Node0TB/timing cũ. API/backend/database, import size CD/FTTH và backup ngoài máy không được sửa trong đợt UI này.
- Không auto-deploy. Khi owner muốn phát hành cần kiểm tra lại candidate/CI, staging smoke và target; bản đồ vẫn phải demo/duyệt riêng trước khi thay giao diện.

Evidence private: `.local/performance/ui-polish-20261101/`, gồm preimage/hash inventory, RED/các lượt lỗi và lượt cuối, browser reports/ảnh, review và scope manifest. Không commit ảnh/log/fixture runtime hoặc dữ liệu riêng.

## Cập nhật phát hành sau đợt local

Sau khi duyệt riêng preview bản đồ, người dùng yêu cầu push/deploy khi kiểm tra đạt. Các thay đổi UI tại đây được giữ nguyên và phát hành cùng ba bản đồ trong commit `e7a152c`; CI41289760697 và build Vercel đạt, alias Production được xác minh, 10 smoke GET trước/sau promote đều đạt. Không sửa API/database hoặc coi các gate nghiệm thu thật còn mở là đã qua. Những ghi chú “chưa commit/push/deploy” phía trên là trạng thái lịch sử của checkpoint79, không phải trạng thái sau checkpoint81. Xem `docs/map-workspace-ui.md` và `tiendokpi.md`.
