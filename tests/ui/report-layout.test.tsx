// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import SummaryKpiPanelClean from "@/app/(dashboard)/prepaid/SummaryKpiPanelClean";
import ManagerSummaryKpiPanelClean from "@/app/(dashboard)/prepaid/ManagerSummaryKpiPanelClean";
import { individualLayoutProps, managerLayoutProps, longIdentity, unicodeIdentity, longManagerName, longJobTitle } from "../fixtures/summary-identity-layout";

afterEach(cleanup);

describe("summary identity layout contract", () => {
  it.each(["individual", "manager"])("isolates the identity layout styles to the %s panel", (panel) => {
    const view = render(panel === "individual" ? <SummaryKpiPanelClean {...individualLayoutProps()} /> : <ManagerSummaryKpiPanelClean {...managerLayoutProps()} />);
    expect(view.container.firstElementChild?.className).toContain("summaryIdentityPanel");
  });

  it.each(["individual", "manager"])("keeps the full %s identity, Unicode and numeric column data", (panel) => {
    render(panel === "individual" ? <SummaryKpiPanelClean {...individualLayoutProps()} /> : <ManagerSummaryKpiPanelClean {...managerLayoutProps()} />);
    const table = screen.getByRole("table");
    const rows = within(table).getAllByRole("row");
    expect(rows).toHaveLength(4);
    expect(within(rows[1]).getAllByRole("cell").map((cell) => cell.textContent)).toEqual([
      panel === "individual" ? longIdentity : `${longIdentity}${longManagerName} • ${longJobTitle}`, "10", "7", "70%", "70%", "3",
    ]);
    expect(within(rows[2]).getAllByRole("cell")[0]).toHaveTextContent(unicodeIdentity);
    expect(within(rows[3]).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["Tổng", "20", "14", "70%", "70%", "6"]);
    expect(screen.getAllByText(longIdentity).length).toBeGreaterThan(1);
  });

  it.each(["individual", "manager"])("retains the direction-aware negative gap label for %s", (panel) => {
    render(panel === "individual"
      ? <SummaryKpiPanelClean {...individualLayoutProps()} summaryMeta={{ isNegativeGroup: true, maxPercent: 120 }} />
      : <ManagerSummaryKpiPanelClean {...managerLayoutProps()} summaryManagerMeta={{ isNegativeGroup: true, maxPercent: 120 }} />);
    expect(within(screen.getByRole("table")).getByRole("columnheader", { name: "Vượt ngưỡng" })).toBeInTheDocument();
  });
});
