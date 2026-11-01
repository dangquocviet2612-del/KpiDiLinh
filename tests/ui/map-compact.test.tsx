// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MapDataSummary from "@/components/map/MapDataSummary";
import MapToolsDisclosure from "@/components/map/MapToolsDisclosure";

describe("compact map controls", () => {
  it("keeps only a one-line count until statistics are requested", () => {
    render(<MapDataSummary label="Số liệu node" totalCount={138} coordinateCount={113} matchedCount={113} inViewportCount={94} scopeNote="25 bản ghi thiếu tọa độ" />);
    expect(screen.getByText("94 trong khung · 113 qua lọc")).toBeVisible();
    expect(screen.getByText("Có tọa độ")).not.toBeVisible();
    expect(screen.getByText("25 bản ghi thiếu tọa độ")).not.toBeVisible();
    fireEvent.click(screen.getByText("Số liệu"));
    expect(screen.getByText("Có tọa độ")).toBeVisible();
    expect(screen.getByText("25 bản ghi thiếu tọa độ")).toBeVisible();
    fireEvent.click(screen.getByText("Số liệu"));
    expect(screen.getByText("Có tọa độ")).not.toBeVisible();
  });

  it("distinguishes zero from unknown values in the compact line", () => {
    render(<MapDataSummary label="Số liệu node" totalCount={0} coordinateCount={0} matchedCount={0} inViewportCount={null} />);
    expect(screen.getByText("— trong khung · 0 qua lọc")).toBeVisible();
  });

  it("keeps secondary actions hidden until tools are opened, with Escape returning focus", () => {
    render(<MapToolsDisclosure><button type="button">Danh sách</button></MapToolsDisclosure>);
    const trigger=screen.getByText("Công cụ bản đồ");
    expect(screen.getByText("Danh sách")).not.toBeVisible();
    fireEvent.click(trigger);
    const action=screen.getByRole("button",{name:"Danh sách"});
    expect(action).toBeVisible();
    action.focus();
    fireEvent.keyDown(action,{key:"Escape"});
    expect(action).not.toBeVisible();
    expect(trigger.closest("summary")).toHaveFocus();
  });

  it("also closes after a nested menu removed the previously focused option", () => {
    render(<MapToolsDisclosure><button type="button">Danh sách</button></MapToolsDisclosure>);
    const trigger=screen.getByText("Công cụ bản đồ");
    fireEvent.click(trigger);
    fireEvent.keyDown(document,{key:"Escape"});
    expect(screen.getByText("Danh sách")).not.toBeVisible();
    expect(trigger.closest("summary")).toHaveFocus();
  });

  it("does not take Escape or focus away from a separate modal", () => {
    render(<><MapToolsDisclosure><button type="button">Danh sách</button></MapToolsDisclosure><div role="dialog" aria-modal="true"><input aria-label="Tên khách hàng" /></div></>);
    fireEvent.click(screen.getByText("Công cụ bản đồ"));
    const input=screen.getByRole("textbox",{name:"Tên khách hàng"});
    input.focus();
    fireEvent.keyDown(input,{key:"Escape"});
    expect(input).toHaveFocus();
    expect(screen.getByText("Danh sách")).toBeVisible();
    fireEvent.keyDown(document,{key:"Escape"});
    expect(input).toHaveFocus();
    expect(screen.getByText("Danh sách")).toBeVisible();
  });
});
