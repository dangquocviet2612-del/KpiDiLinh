import { describe, it, expect } from "vitest";
import * as xlsx from "xlsx";
import {
  buildDisconnectCtvUsernameMaps,
  DISCONNECT_SOURCE_FTTH,
  DISCONNECT_SOURCE_TV,
  parseDisconnectWorksheetRows,
  resolveDisconnectCtvUsername,
} from "@/lib/disconnect";

describe("Disconnect CTV Mapping & Sheet Parsing", () => {
  it("resolves CTV username case-insensitively and through secondary codes", () => {
    const maps = buildDisconnectCtvUsernameMaps([
      { username: "ANLT_LDG_CNKD", secondaryCode: "ANLT" },
      { username: "LINHPM_LDG_CNKD", secondaryCode: "LINHPM" },
    ]);

    expect(resolveDisconnectCtvUsername("ANLT", maps)).toBe("ANLT_LDG_CNKD");
    expect(resolveDisconnectCtvUsername("anlt", maps)).toBe("ANLT_LDG_CNKD");
    expect(resolveDisconnectCtvUsername("ANLT_LDG_CNKD", maps)).toBe("ANLT_LDG_CNKD");
    expect(resolveDisconnectCtvUsername("LINHPM_LDG_CNKD", maps)).toBe("LINHPM_LDG_CNKD");
    expect(resolveDisconnectCtvUsername("UNKNOWN_CODE", maps)).toBe("");
  });

  it("parses TV disconnect worksheet correctly", () => {
    const tvSheet = xlsx.utils.aoa_to_sheet([
      ["THUE_BAO", "DICH_VU", "STAFF_CODE_THU_CUOC", "NGAY_CHAN_CHAR"],
      ["vt0982614739", "TV360 Box", "ANLT", "01/02/2026"],
    ]);
    const tvParsed = parseDisconnectWorksheetRows(tvSheet, DISCONNECT_SOURCE_TV);
    expect(tvParsed.headerValidation.matches).toBe(true);
    expect(tvParsed.rows.length).toBe(1);
    expect(tvParsed.rows[0]?.serviceName).toBe("TV360 Box");
    expect(tvParsed.rows[0]?.cancelMonth).toBe("2026-04");
  });

  it("parses FTTH disconnect worksheet correctly", () => {
    const ftthSheet = xlsx.utils.aoa_to_sheet([
      ["THUE_BAO", "GOI_CUOC", "STAFF_CODE_THU_CUOC", "NGAY_CHAN_CHAR"],
      ["l063_gftth_demo01", "HOME 2", "LINHPM", "15/02/2026"],
    ]);
    const ftthParsed = parseDisconnectWorksheetRows(ftthSheet, DISCONNECT_SOURCE_FTTH);
    expect(ftthParsed.headerValidation.matches).toBe(true);
    expect(ftthParsed.rows.length).toBe(1);
    expect(ftthParsed.rows[0]?.serviceName).toBe("HOME 2");
    expect(ftthParsed.rows[0]?.cancelMonth).toBe("2026-04");
  });
});
