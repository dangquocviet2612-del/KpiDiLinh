// @vitest-environment jsdom

import { render } from "@testing-library/react";
import axe from "axe-core";
import { describe, expect, it } from "vitest";
import AsyncState from "@/components/ui/AsyncState";
import FormField from "@/components/ui/FormField";

describe("shared UI accessibility", () => {
  it("has no detectable axe violations in common states", async () => {
    render(
      <main>
        <FormField id="account" label="Mã khách hàng" hint="Nhập mã trên hợp đồng." required>
          <input />
        </FormField>
        <AsyncState
          status="empty"
          title="Chưa có dữ liệu"
          description="Thay đổi bộ lọc hoặc thêm dữ liệu mới."
        />
      </main>,
    );

    const result = await axe.run(document.body, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(result.violations).toEqual([]);
  });
});
