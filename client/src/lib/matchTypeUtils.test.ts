import { describe, expect, it } from "vitest";
import { canonicalMatchType, isExactMatchType } from "./matchTypeUtils";

describe("匹配类型别名识别", () => {
  it("应将历史数据的精准匹配、精确匹配和英文EXACT统一识别为精准匹配", () => {
    expect(isExactMatchType("精准匹配")).toBe(true);
    expect(isExactMatchType("精确匹配")).toBe(true);
    expect(isExactMatchType("紧密匹配")).toBe(true);
    expect(isExactMatchType("exact")).toBe(true);
    expect(isExactMatchType("广泛匹配")).toBe(false);
  });

  it("应将具体ASIN和自动投放子类型统一归类", () => {
    expect(canonicalMatchType('asin="B0DZNGZNLK"')).toBe("ASIN匹配");
    expect(canonicalMatchType("B0DZNGZNLK")).toBe("ASIN匹配");
    expect(canonicalMatchType("close-match")).toBe("自动匹配");
    expect(canonicalMatchType("loose-match")).toBe("自动匹配");
    expect(canonicalMatchType("substitutes")).toBe("自动匹配");
  });
});
