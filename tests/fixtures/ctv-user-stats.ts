export const syntheticCtvUsers = [
  { id: "synthetic-admin", username: "synthetic_admin", role: "ADMIN", canUseGps: false, createdAt: "2026-10-29T00:00:00.000Z" },
  { id: "synthetic-ctv-a", username: "synthetic_ctv_a", role: "CTV", canUseGps: true, secondaryCode: "SYNTHETIC_A", managerCode: "synthetic_manager", createdAt: "2026-10-29T00:00:00.000Z" },
  { id: "synthetic-ctv-b", username: "synthetic_ctv_b", role: "CTV", canUseGps: false, secondaryCode: "SYNTHETIC_B", managerCode: "synthetic_manager", createdAt: "2026-10-29T00:00:00.000Z" },
  { id: "synthetic-manager", username: "synthetic_manager", role: "MANAGER", canUseGps: true, createdAt: "2026-10-29T00:00:00.000Z" },
];

export const syntheticCtvKpis = [{ kpiCode: "SYNTH_KPI_01", displayName: "Chỉ tiêu giả lập", mergeGroup: "", baseScore: 10, maxPercent: 120, isEnabled: 1, isNegative: 0 }];
export const expectedCtvStatValues = ["3", "2", "1", "2"];
export const ctvStatHints = [
  "Toàn bộ tài khoản CTV và quản lý trong hệ thống",
  "Tài khoản cộng tác viên đang hoạt động",
  "Tài khoản quản lý đang theo dõi CTV",
  "Số tài khoản được phép lấy vị trí hiện tại",
];
