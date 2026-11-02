# Thiết kế công tắc giao diện Sáng/Tối trong sidebar

## Mục tiêu

Khôi phục điều khiển đổi giao diện ở vị trí dễ thấy ngay dưới mục **Đổi mật khẩu**. Điều khiển hiển thị rõ hai nhãn **Sáng** và **Tối**, hoạt động trên desktop lẫn mobile và giữ nguyên cơ chế theme hiện có.

## Thiết kế giao diện

- Thêm một hàng cài đặt ngay dưới liên kết **Đổi mật khẩu** và trước **Đăng xuất**.
- Bên trái hàng hiển thị biểu tượng theme cùng nhãn **Giao diện**.
- Bên phải là công tắc hai trạng thái có nhãn **Sáng** và **Tối**; trạng thái đang chọn được thể hiện rõ bằng vị trí nút gạt và tương phản màu.
- Toàn bộ điều khiển có vùng bấm tối thiểu 44px, không bị khuất trong sidebar mobile và dùng lại token màu hiện có.

## Hành vi

- Bấm hoặc dùng Space/Enter đổi ngay giữa `light` và `dark`.
- Trạng thái công tắc phản ánh theme đã lưu trong `localStorage`; nếu người dùng chưa từng chọn thì mặc định áp dụng giao diện tối, không phụ thuộc tùy chọn theme của hệ điều hành.
- Tiếp tục ghi lựa chọn vào khóa `theme` trong `localStorage` và cập nhật `data-theme` trên phần tử `html`.
- Không thêm chế độ thứ ba và không thay đổi bảng màu hiện tại.

## Khả năng truy cập

- Dùng button có `role="switch"` và `aria-checked` để công nghệ hỗ trợ đọc đúng trạng thái.
- Dùng tên truy cập ổn định **Giao diện tối** trước và sau khi chuyển; trạng thái chỉ được biểu đạt qua `aria-checked`, còn hai nhãn nhìn thấy **Sáng/Tối** luôn hiện diện.
- Có focus-visible rõ ràng, không phụ thuộc riêng vào màu sắc để biểu đạt trạng thái.

## Kiểm thử

- Viết kiểm thử hồi quy trước để xác nhận công tắc nằm ngay sau **Đổi mật khẩu**.
- Xác nhận trạng thái ban đầu từ cả theme sáng và tối đã lưu; khi chưa có giá trị lưu, xác nhận mặc định tối bất kể `prefers-color-scheme` khớp hay không, đồng thời kiểm tra `data-theme` cùng trạng thái switch.
- Xác nhận chuyển Sáng/Tối khi bấm, cập nhật DOM và `localStorage`.
- Kiểm tra role, `aria-checked`, hai nhãn nhìn thấy, tên truy cập ổn định trước/sau khi chuyển, hành vi bàn phím và styling focus-visible của button.
- Chạy focused test, toàn bộ test liên quan, TypeScript và lint sau triển khai.

## Ngoài phạm vi

- Không đổi palette, API, auth, database hoặc bố cục các mục sidebar khác.
- Không commit, push hay deploy nếu chưa có yêu cầu riêng của người dùng.
