# Kiến Trúc Quản Lý State & Chiến Lược Mở Rộng (Distributed State & Scaling)

## 1. Hiện Trạng Hệ Thống (Single Node / VPS)

Hiện tại, Customer Manager đang quản lý bộ nhớ đệm (Cache) và giới hạn tần suất gọi API (Rate Limiting) thông qua In-Memory data structures:
- **Rate Limiting (`src/lib/rate-limit.ts`)**: Lưu trữ `Map<string, RateLimitEntry>` gắn trên `globalThis.__rateLimitStore`.
- **Scope & KPI Cache (`src/lib/kpi-cache.ts`)**: Lưu trữ `Map<string, CacheItem>` (TTL 30 giây đến 10 phút) để giảm tải các câu query đếm KPI, scope CTV và cấu hình cước.

### Ưu điểm hiện tại:
- **Tốc độ cực nhanh**: Độ trễ truy xuất gần như 0ms (Direct RAM Access).
- **Đơn giản, không phụ thuộc**: Không cần duy trì thêm dịch vụ hạ tầng phụ trợ (Redis server).
- **Phù hợp tuyệt đối**: Chạy hoàn hảo trên VPS đơn, Docker container hoặc PM2 cluster (nếu không cần chia sẻ state rate-limit giữa các thread).

---

## 2. Thách Thức Khi Mở Rộng Hệ Thống (Multi-Instance / Serverless)

Khi hệ thống mở rộng theo 2 mô hình sau:
1. **Serverless (Vercel / AWS Lambda)**:
   - Mỗi HTTP request có thể khởi chạy một micro-container (isolate) riêng biệt.
   - In-memory `Map` bị phân mảnh giữa các lambda containers. Rate limiter có thể bị bypass nếu các request phân tán vào các container khác nhau.
2. **Horizontal Scaling (Kubernetes / Load Balancer nhiều VPS)**:
   - Request 1 đến Server A (cache được lưu ở A), Request 2 đến Server B (Server B chưa có cache, phải query lại Turso DB).
   - Invalidation (xóa cache khi có cập nhật dữ liệu) ở Server A sẽ không đồng bộ sang Server B.

---

## 3. Lộ Trình Chuyển Đổi Sang Distributed State (Upstash / Redis)

Khi lưu lượng truy cập tăng hoặc triển khai Multi-Node, hệ thống có thể chuyển đổi trong suốt sang kiến trúc Distributed Cache thông qua thiết kế Adapter:

### Sơ đồ kiến trúc chuyển đổi:
```
[ Client Requests ]
        │
        ▼
[ Next.js Instances (Node.js / Edge) ]
        │
        ├── In-Memory Map (Fallback Local / Dev)
        │
        └── Upstash Redis / Redis Cluster (Distributed State)
                ├── Keys: `rl:*` (Rate Limiting với lệnh INCR + EXPIRE)
                ├── Keys: `scope:*` (Cache CTV Scopes)
                └── Keys: `kpi:*` (Cache kết quả tính KPI)
```

### Triển khai Khuyến nghị (Upstash Redis cho Next.js / Serverless):
- **Giao thức**: REST API qua HTTP (`@upstash/redis`), tương thích 100% với cả Edge Runtime và Serverless Node.js, không gặp lỗi cạn kiệt TCP connection pool.
- **Biến môi trường cần thêm**:
  ```env
  UPSTASH_REDIS_REST_URL="https://***.upstash.io"
  UPSTASH_REDIS_REST_TOKEN="***"
  ```
- **Tự động Fallback**: Code logic của `rate-limit.ts` và `kpi-cache.ts` kiểm tra: nếu không có biến `UPSTASH_REDIS_REST_URL`, tự động fallback về in-memory `Map` nội bộ, đảm bảo tính liên tục của môi trường dev local.
