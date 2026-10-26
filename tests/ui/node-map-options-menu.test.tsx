// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import NodeMapOptionsMenu from "@/app/(dashboard)/node-map/NodeMapOptionsMenu";

function renderMenu(canAdmin = false) {
  const onExport = vi.fn();
  const onMapStyleChange = vi.fn();

  render(
    <NodeMapOptionsMenu
      open
      canAdmin={canAdmin}
      mapStyle="light"
      busy={false}
      onToggle={vi.fn()}
      onClose={vi.fn()}
      onExport={onExport}
      onMapStyleChange={onMapStyleChange}
      onUploadNodes={vi.fn()}
      onUploadEfficiency={vi.fn()}
      onUploadCustomerNodeMap={vi.fn()}
      onShowCustomerNodeMappings={vi.fn()}
      onDownloadCustomerNodeTemplate={vi.fn()}
      onDownloadNodeEfficiencyTemplate={vi.fn()}
    />,
  );

  return { onExport, onMapStyleChange };
}

describe("NodeMapOptionsMenu", () => {
  it("groups export and map styles under one clear action", async () => {
    const user = userEvent.setup();
    const { onExport, onMapStyleChange } = renderMenu();

    await user.click(screen.getByRole("menuitem", { name: "Xuất Excel" }));
    await user.click(screen.getByRole("menuitemradio", { name: "Bản đồ tối" }));

    expect(onExport).toHaveBeenCalledOnce();
    expect(onMapStyleChange).toHaveBeenCalledWith("dark");
    expect(screen.queryByText("Nhập dữ liệu")).not.toBeInTheDocument();
  });

  it("shows data management actions only to admins", () => {
    renderMenu(true);

    expect(screen.getByText("Nhập dữ liệu")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Nhập vị trí KML/KMZ" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Xem mapping Account - Node" })).toBeInTheDocument();
  });
});
