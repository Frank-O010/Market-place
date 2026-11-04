import { beforeEach, describe, expect, it } from "vitest";
import { memoryLimit, resetMemoryLimits } from "./rate-limit";

describe("memoryLimit", () => {
  beforeEach(() => resetMemoryLimits());

  it("allows requests up to the limit, then blocks", () => {
    const now = 1_000_000;
    const results = Array.from({ length: 4 }, () => memoryLimit("signIn:1.2.3.4", 3, 60, now));
    expect(results.map((r) => r.success)).toEqual([true, true, true, false]);
    expect(results[3]?.remaining).toBe(0);
  });

  it("resets after the window passes", () => {
    const now = 1_000_000;
    for (let i = 0; i < 3; i++) memoryLimit("k", 3, 60, now);
    expect(memoryLimit("k", 3, 60, now).success).toBe(false);
    expect(memoryLimit("k", 3, 60, now + 61_000).success).toBe(true);
  });

  it("tracks identifiers separately", () => {
    const now = 1_000_000;
    memoryLimit("a", 1, 60, now);
    expect(memoryLimit("a", 1, 60, now).success).toBe(false);
    expect(memoryLimit("b", 1, 60, now).success).toBe(true);
  });
});
