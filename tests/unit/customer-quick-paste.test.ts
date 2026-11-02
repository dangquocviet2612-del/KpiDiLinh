import { describe, expect, it } from "vitest";
import { parseCustomerQuickPaste } from "@/lib/customer-quick-paste";

const users = [{ username: "phuav_ldg_cnkd" }];
const lines = ["11.503610559826157, 107.95302872883524", "phuav", "nguyễn văn nam", "ldg_gftth_namnv14"];
describe("customer quick paste", () => {
  it.each([lines, [lines[3], lines[2], lines[0], "PHUAV_LDG_CNKD"], [...lines].reverse()])("recognizes shuffled full/short usernames", (...input) => {
    expect(parseCustomerQuickPaste(input.join("\n"), users)).toEqual({ name: lines[2], account: lines[3], ctvCode: users[0].username, latitude: "11.503610559826157", longitude: "107.95302872883524" });
  });
  it("swaps coordinates only when necessary", () => {
    expect(parseCustomerQuickPaste(["107.95, 11.50", ...lines.slice(1)].join("\n"), users)).toMatchObject({ latitude: "11.5", longitude: "107.95" });
    expect(parseCustomerQuickPaste(["45, 60", ...lines.slice(1)].join("\n"), users)).toMatchObject({ latitude: "45", longitude: "60" });
  });
  it.each(["91, 92", "181, 11", "11, 181", "NaN, 107", "11, 107 trailing"])("rejects invalid coordinates %s", (coordinates) => {
    expect(() => parseCustomerQuickPaste([coordinates, ...lines.slice(1)].join("\n"), users)).toThrow();
  });
  it("rejects unknown, ambiguous and duplicate CNKD", () => {
    expect(() => parseCustomerQuickPaste(lines.join("\n"), [])).toThrow(/CNKD/);
    expect(() => parseCustomerQuickPaste(lines.join("\n"), [...users, { username: "PHUAV_LDG_CNKD" }])).toThrow(/nhiều/);
    expect(() => parseCustomerQuickPaste([lines[0], "phuav", "phuav_ldg_cnkd", lines[3]].join("\n"), users)).toThrow();
  });
  it.each([lines.slice(1), [...lines, "extra"], [lines[0], "phuav", "another_account", lines[3]]])("rejects incomplete/extra/ambiguous lines", (...input) => {
    expect(() => parseCustomerQuickPaste(input.join("\n"), users)).toThrow();
  });
});
