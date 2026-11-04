import { describe, expect, it } from "vitest";
import { commission, formatKes, parseKes } from "./money";

describe("parseKes", () => {
  it("parses whole and fractional shillings into minor units", () => {
    expect(parseKes("1250")).toBe(125_000);
    expect(parseKes("1,250.5")).toBe(125_050);
    expect(parseKes("KES 99.99")).toBe(9_999);
  });

  it("rejects malformed amounts", () => {
    expect(() => parseKes("12.345")).toThrow();
    expect(() => parseKes("-5")).toThrow();
    expect(() => parseKes("abc")).toThrow();
  });
});

describe("commission", () => {
  it("calculates 10% commission", () => {
    expect(commission(125_000, 1_000)).toBe(12_500);
  });

  it("rounds half up to the nearest minor unit", () => {
    expect(commission(5, 1_000)).toBe(1); // 0.5 -> 1
    expect(commission(4, 1_000)).toBe(0); // 0.4 -> 0
  });

  it("rejects floats and out-of-range rates", () => {
    expect(() => commission(10.5, 1_000)).toThrow(TypeError);
    expect(() => commission(100, 10_001)).toThrow(RangeError);
    expect(() => commission(100, 12.5)).toThrow(RangeError);
  });
});

describe("formatKes", () => {
  it("formats minor units as Kenyan shillings", () => {
    expect(formatKes(125_000)).toMatch(/1,250/);
    expect(formatKes(125_050)).toMatch(/1,250\.5/);
  });
});
