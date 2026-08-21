import { describe, expect, it } from "vitest";
import { calculateChange, formatChange, formatPeriodLabel } from "./weeklyOverviewUtils";

describe("周度总看板工具", () => {
  it("应正确计算正负环比与无基数情况", () => {
    expect(calculateChange(120, 100)).toBe(0.2);
    expect(calculateChange(80, 100)).toBe(-0.2);
    expect(calculateChange(100, 0)).toBeNull();
  });

  it("应格式化环比与分析周期标签", () => {
    expect(formatChange(0.196)).toBe("+19.6%");
    expect(formatChange(-0.125)).toBe("-12.5%");
    expect(formatChange(null)).toBe("—");
    expect(formatPeriodLabel("分析 2026/8/7", "2026-08-07")).toBe("2026/8/7");
  });
});
