import { describe, expect, it } from "vitest";
import { encodeMapEventValue, escapeMapHtml, formatMapPercent, isValidMapCoordinate } from "@/lib/map-ui";

describe("map UI helpers", () => {
  it("escapes user-controlled values before inserting them into Leaflet popup HTML", () => {
    expect(escapeMapHtml(`<img src=x onerror="alert('x')"> & data`)).toBe(
      "&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt; &amp; data",
    );
  });

  it("returns an empty string for nullish popup values", () => {
    expect(escapeMapHtml(null)).toBe("");
    expect(escapeMapHtml(undefined)).toBe("");
  });

  it("formats stored efficiency ratios as percentages", () => {
    expect(formatMapPercent(0.13)).toBe("13.00%");
    expect(formatMapPercent(0)).toBe("0.00%");
    expect(formatMapPercent(null)).toBe("-");
    expect(formatMapPercent(Number.NaN)).toBe("-");
  });

  it("encodes popup event values without leaving inline-handler delimiters", () => {
    const value = `NODE-'Đắk Lắk' "<100%>"`;
    const encoded = encodeMapEventValue(value);

    expect(encoded).not.toMatch(/['"<>]/);
    expect(decodeURIComponent(encoded)).toBe(value);
  });

  it("accepts only finite latitude and longitude values in range", () => {
    expect(isValidMapCoordinate(0, 0)).toBe(true);
    expect(isValidMapCoordinate(90, 180)).toBe(true);
    expect(isValidMapCoordinate(90.1, 107)).toBe(false);
    expect(isValidMapCoordinate(11, 180.1)).toBe(false);
    expect(isValidMapCoordinate(Number.NaN, 107)).toBe(false);
  });
});
