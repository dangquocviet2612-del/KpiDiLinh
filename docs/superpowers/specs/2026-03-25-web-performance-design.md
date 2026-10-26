# Web Performance Design

**Date:** 2026-03-25

**Goal**

Giảm độ trễ chung khi tải dữ liệu trên nhiều màn của CRM, ưu tiên các route và fetch pattern dùng chung trước khi tối ưu từng module riêng lẻ.

**Scope**

- Tối ưu các route GET dùng chung:
  - `/api/me`
  - `/api/users`
  - `/api/customers`
  - `/api/customers/map-data`
  - `/api/customers/search-map`
  - `/api/node-search-map`
- Tối ưu helper scope lặp lại trên nhiều route.
- Giảm refetch dư ở các màn lớn, ưu tiên `customers`, `map`, `node-map`, `prepaid`.

**Approach**

1. Thêm cache TTL ngắn cho dữ liệu ít đổi nhưng bị gọi lặp.
2. Giảm overfetch bằng `select` rõ ràng, giới hạn `take`, tránh tải cả bản ghi khi UI không cần.
3. Thêm invalidation theo prefix ở các route mutation chính để cache không stale quá lâu.
4. Giảm số request dư trong client ở các màn nặng.

**Non-goals**

- Chưa tối ưu import Excel trong lượt này.
- Chưa làm profiling sâu hoặc benchmark tự động.
- Chưa thay đổi cấu trúc DB lớn hoặc migration schema mới chỉ để tối ưu hiệu năng.

**Expected outcome**

- Vào trang lần đầu nhanh hơn ở các màn dùng chung.
- Chuyển filter/search/pagination đỡ khựng hơn.
- Các màn map phản hồi nhanh hơn khi tìm kiếm hoặc tải marker.
- `prepaid` bớt gọi API trùng ở các view summary.

