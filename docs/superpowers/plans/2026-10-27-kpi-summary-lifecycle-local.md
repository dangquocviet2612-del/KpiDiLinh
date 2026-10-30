# KPI summary request lifecycle — local batch 6

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Tiếp tục phần lifecycle của Task 5/đợt 2 đã được yêu cầu làm tiếp: summary và manager-summary không fetch lặp, không trả response lỗi thời vào UI khi đổi view/scope/filter, giữ nghiệp vụ và API.

**Architecture:** Tái sử dụng `useLatestKpiRequest` đang dùng cho personal/calculator, hai resource owner độc lập cho summary/manager. Key gồm resource, scope id/name/role, ngày, manager filter và group. Pending cùng key được dedupe; filter/view đổi hủy fetch và chặn stale success/error/settled. Scope đổi reset cả data/meta/error/keys; view quay lại và refresh tường minh reload. Auto group/date có alias đúng intent, không tạo request vòng lặp. Nhánh manager `__all__`, KPI âm/cước, totals và import latest-date giữ semantics cũ.

**Tech Stack:** React/TypeScript, Vitest/RTL, Chrome thật với fixture giả có sẵn. Không đổi dependency/provider/schema/SQL.

**Phạm vi:** `src/app/(dashboard)/prepaid/PrepaidPageImpl.tsx`, test lifecycle summary/manager mới trong `tests/ui/`, chỉ sửa hook dùng chung nếu test chứng minh cần thiết. Không tách view/bundle/CSS trong cùng slice; không thay policy JWT, SLA đa instance hoặc server cache. `/api/me` sharing/hydration, RUM và Task 7 vẫn pending.

**Guardrails:** Không commit/push/deploy batch mới, không dùng env/database Production/backup thật. Dùng checkout tách riêng hiện hữu có app source khớp primary `9d0365e`; không reset checkout HEAD cũ. Snapshot hash trước sửa, kiểm tra lại primary trước tích hợp. Lỗi `/api/me` 500 từng thấy khi deploy trước không được tuyên bố đã sửa bằng client lifecycle.

## 1. Baseline và regression

- [x] Snapshot hai checkout, xác nhận source khớp và giữ nguyên những khác biệt tài liệu lịch sử (380 file/312 source khớp; baseline 12 UI test đạt; Chrome 8 case đều 4 report requests).
- [x] Viết test FAIL summary và manager: pending-key dedupe khi session object equivalent; auto date/group không fetch lặp; filter nhanh và stale response/error; view hidden/unmount cancellation; đổi auth scope không lộ rows cũ; retry/refresh; `__all__` và import trả ngày mới.
- [x] Chạy trên source gốc: RED 32 fail/3 pass (35); boundary review RED 1 fail/41 pass (42), giữ nguyên log, không crash/retry/ignore.

## 2. Implementation và review

- [x] Tái sử dụng resource owner/lifecycle hook, reset/cancel đúng boundary và giữ presentation/formula/API contract. Abort cả trong khoảng debounce trước request mới.
- [x] Import/refresh không kích hoạt request cho panel ẩn; vô hiệu alias/data cũ để panel được mở lại đọc đúng dữ liệu, giữ report date sau import. Calculator có local data-revision để bỏ alias trước import, không gọi callback đã capture view cũ.
- [x] GREEN targeted 62/62; spec review và quality review đã approve sau hai P2 có RED/GREEN riêng, giữ automatic-resolution và hidden-panel controls.

## 3. Xác minh và tích hợp

- [x] Full checkout sau hai P2 review: 57 file/620 test + 22 policy, TypeScript/lint/build đạt (3 warning cũ); Chrome 8 case, 4→1 report request mỗi case, payload hashes khớp, retry/đổi ngày nhanh/back navigation đạt, fake database không đổi qua build/GET.
- [x] Tích hợp 6 file sau hash-check/backup và secret scan; primary đạt 57 file/620 test + 22 policy, TypeScript/lint đạt (3 warning cũ). Roadmap/tiến độ giữ Task 5 và đợt 2 partial; không commit/push/deploy hoặc chạm dữ liệu thật.

**Acceptance:** Personal/calculator regressions vẫn xanh; summary/manager chỉ tải view đang mở, một pending request cho mỗi intent/key, không stale response qua filter/scope/view boundary. Không đánh dấu xong toàn Task 5/đợt 2 nếu shared `/api/me`, server hydration, permission/cache đa instance hoặc benchmark chưa được làm.
