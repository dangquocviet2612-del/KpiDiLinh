import { describe, it, expect } from "vitest";
import {
  BUILTIN_SIM_TEMPLATES,
  normalizeSimNumber,
  formatSimDisplay,
} from "@/lib/tools-sim";

describe("Tools SIM: Helper & Configuration Tests", () => {
  describe("BUILTIN_SIM_TEMPLATES", () => {
    it("has the primary Viettel 5G red template configured correctly", () => {
      const template = BUILTIN_SIM_TEMPLATES.find((t) => t.id === "viettel-5g-red");
      expect(template).toBeDefined();
      expect(template?.width).toBe(1024);
      expect(template?.height).toBe(682);
      expect(template?.imageUrl).toBe("/templates/sim/viettel-5g-red.png");
      expect(template?.numberConfig.centerX).toBeGreaterThan(0);
      expect(template?.numberConfig.centerY).toBeGreaterThan(0);
      expect(template?.numberConfig.patchArea.width).toBeGreaterThan(0);
      expect(template?.subtitleConfig?.defaultText).toContain("SỐ ĐẸP");
    });
    it("has the Viettel 4G Hand template configured correctly", () => {
      const template = BUILTIN_SIM_TEMPLATES.find((t) => t.id === "viettel-4g-hand");
      expect(template).toBeDefined();
      expect(template?.width).toBe(1024);
      expect(template?.height).toBe(1024);
      expect(template?.imageUrl).toBe("/templates/sim/viettel-4g-hand.jpg");
      expect(template?.numberConfig.centerX).toBe(504);
      expect(template?.numberConfig.color).toBe("#000000");
    });
    it("contains 4 standard brand-accurate templates with proper adminOnly brand flags", () => {
      expect(BUILTIN_SIM_TEMPLATES.length).toBe(4);

      const viettelTemplates = BUILTIN_SIM_TEMPLATES.filter((t) => t.brand === "Viettel");
      const vinaTemplates = BUILTIN_SIM_TEMPLATES.filter((t) => t.brand === "Vinaphone");
      const mobiTemplates = BUILTIN_SIM_TEMPLATES.filter((t) => t.brand === "MobiFone");

      expect(viettelTemplates.length).toBe(2);
      expect(vinaTemplates.length).toBe(1);
      expect(mobiTemplates.length).toBe(1);

      // All Viettel templates are public to non-admin
      expect(viettelTemplates.every((t) => !t.adminOnly)).toBe(true);

      // All Vinaphone and MobiFone templates are admin-only
      expect(vinaTemplates.every((t) => t.adminOnly === true)).toBe(true);
      expect(mobiTemplates.every((t) => t.adminOnly === true)).toBe(true);
    });
  });

  describe("normalizeSimNumber", () => {
    it("removes spaces, dots, dashes and letters", () => {
      expect(normalizeSimNumber("0325.598.798")).toBe("0325598798");
      expect(normalizeSimNumber("0325-598-798")).toBe("0325598798");
      expect(normalizeSimNumber("0325 598 798")).toBe("0325598798");
      expect(normalizeSimNumber("0325abc598xyz798")).toBe("0325598798");
    });

    it("converts +84 and 84 prefix to 0", () => {
      expect(normalizeSimNumber("+84 325 598 798")).toBe("0325598798");
      expect(normalizeSimNumber("84325598798")).toBe("0325598798");
    });

    it("handles empty or falsy inputs gracefully", () => {
      expect(normalizeSimNumber("")).toBe("");
    });
  });

  describe("formatSimDisplay", () => {
    it("formats 10-digit number as 4-3-3 pattern", () => {
      expect(formatSimDisplay("0325598798", "4-3-3")).toBe("0325 598 798");
      expect(formatSimDisplay("0988123456", "4-3-3")).toBe("0988 123 456");
    });

    it("formats 10-digit number as 4.3.3 dot pattern", () => {
      expect(formatSimDisplay("0378869567", "4.3.3")).toBe("0378.869.567");
      expect(formatSimDisplay("0988123456", "4.3.3")).toBe("0988.123.456");
    });

    it("formats 10-digit number as 3-3-4 pattern", () => {
      expect(formatSimDisplay("0325598798", "3-3-4")).toBe("032 559 8798");
      expect(formatSimDisplay("0988123456", "3-3-4")).toBe("098 812 3456");
    });

    it("formats 10-digit number as 3.3.4 dot pattern", () => {
      expect(formatSimDisplay("0325598798", "3.3.4")).toBe("032.559.8798");
    });

    it("formats 10-digit number as raw unspaced digits", () => {
      expect(formatSimDisplay("0325 598 798", "raw")).toBe("0325598798");
    });

    it("respects custom pattern input verbatim", () => {
      expect(formatSimDisplay("0325598798", "custom", "03.25.598.798")).toBe("03.25.598.798");
    });
  });
});
