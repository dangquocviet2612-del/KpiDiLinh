import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import MapSearchResults from "@/components/MapSearchResults";

describe("MapSearchResults", () => {
  it("renders each selectable result as a keyboard-accessible button", () => {
    const html = renderToStaticMarkup(
      createElement(MapSearchResults<{ id: string; name: string }>, {
        id: "node-map-results",
        items: [{ id: "node-1", name: "NODE-01" }],
        resultNoun: "node",
        emptyText: "Không có kết quả",
        onSelect: () => undefined,
        getPrimaryText: (item) => item.name,
      }),
    );

    expect(html).toContain('<button type="button"');
    expect(html).toContain('id="node-map-results"');
    expect(html).toContain("NODE-01");
  });

  it("exposes active result semantics for combobox navigation", () => {
    const html = renderToStaticMarkup(
      createElement(MapSearchResults<{ id: string; name: string }>, {
        id: "node-map-results",
        items: [
          { id: "node-1", name: "NODE-01" },
          { id: "node-2", name: "NODE-02" },
        ],
        resultNoun: "node",
        emptyText: "Không có kết quả",
        onSelect: () => undefined,
        getPrimaryText: (item) => item.name,
        activeIndex: 1,
        onActiveIndexChange: () => undefined,
      }),
    );

    expect(html).toContain('role="listbox"');
    expect(html).toContain('id="node-map-results-option-1"');
    expect(html).toContain('aria-selected="true"');
  });
});
