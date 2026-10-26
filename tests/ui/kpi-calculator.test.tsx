// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import KpiCalculatorPanel from "@/app/(dashboard)/prepaid/KpiCalculatorPanel";
import type { KpiCalculatorRow } from "@/lib/kpi-report-calculation";

const row: KpiCalculatorRow = {
  kpiCode: "KPI01",
  displayName: "Thuê bao mới",
  kpiName: "Thuê bao mới",
  mergeGroup: null,
  khThang: 10,
  thNgay: 8,
  thLuyKe: 8,
  completionPercent: 80,
  growthPercent: 0,
  baseScore: 10,
  maxPercent: 120,
  maxScore: 12,
  achievedScore: 8,
  sortOrder: 1,
  isNegativeKpi: false,
  isCuocRateKpi: false,
  ctvUser: "CTV_A",
  thCurrent: 8,
  thSimulated: 8,
  simulatedCompletionPercent: 80,
  simulatedAchievedScore: 8,
  deltaScore: 0,
};

function renderCalculator() {
  const onDraftValueChange = vi.fn();
  const onStepDraftValue = vi.fn();
  const onSetTargetValue = vi.fn();

  render(
    <KpiCalculatorPanel
      canSelectCtv={false}
      ctvOptions={[]}
      selectedCtv="CTV_A"
      reportDate="2026-09-20"
      loading={false}
      refreshing={false}
      errorMessage={null}
      rows={[row]}
      changeSummaryRows={[]}
      draftValues={{ KPI01: "8" }}
      dirtyCount={0}
      totals={{
        totalBaseScore: 10,
        totalCurrentScore: 10,
        totalSimulatedScore: 12,
        totalDeltaScore: 2,
        missingToHundred: 0,
        exceededOverHundred: 2,
        scorePercentCurrent: 100,
        scorePercentSimulated: 120,
      }}
      surfaceActionBtnClass="action"
      surfacePrimaryBtnClass="primary"
      surfaceBadgeClass="badge"
      surfaceChipClass="chip"
      getPercentBgClass={() => ""}
      getPercentClass={() => ""}
      getThieuBgClass={() => ""}
      getThieuClass={() => ""}
      onBack={vi.fn()}
      onSelectedCtvChange={vi.fn()}
      onReportDateChange={vi.fn()}
      onRefresh={vi.fn()}
      onReset={vi.fn()}
      onDraftValueChange={onDraftValueChange}
      onStepDraftValue={onStepDraftValue}
      onSetTargetValue={onSetTargetValue}
    />,
  );

  return { onDraftValueChange, onStepDraftValue, onSetTargetValue };
}

describe("KPI calculator", () => {
  it("supports direct input, configurable steps and a 100-percent shortcut", async () => {
    const user = userEvent.setup();
    const callbacks = renderCalculator();

    fireEvent.change(screen.getAllByRole("textbox", { name: "TH giả lập của Thuê bao mới" })[0], {
      target: { value: "9,5" },
    });
    expect(callbacks.onDraftValueChange).toHaveBeenCalledWith("KPI01", "9,5");

    await user.selectOptions(screen.getByRole("combobox", { name: "Bước tăng giảm" }), "10");
    await user.click(screen.getAllByRole("button", { name: "Tăng TH giả lập của Thuê bao mới" })[0]);
    expect(callbacks.onStepDraftValue).toHaveBeenCalledWith("KPI01", 10);

    await user.click(screen.getAllByRole("button", { name: "Đặt Thuê bao mới đạt 100%" })[0]);
    expect(callbacks.onSetTargetValue).toHaveBeenCalledWith("KPI01");
  });

  it("labels score above the 100-percent target as exceeded", () => {
    renderCalculator();

    expect(screen.getByText("Vượt chuẩn 100%")).toBeInTheDocument();
    expect(screen.getAllByText("+2,00").length).toBeGreaterThan(0);
  });
});
