import { describe, expect, it } from "vitest";
import { analyzeProductPerformance, getSalesGrade, type ProductSourceRow } from "./productPerformanceEngine";

const row = (overrides: Partial<ProductSourceRow>): ProductSourceRow => ({
  asin: "B0TEST", sku: "SKU-TEST", store: "US", ownerName: "陈黎", title: "测试产品",
  units: 160, sales: 4000, orders: 150, grossProfit: 1000, profitMargin: 0.25,
  sessions: 3000, clicks: 400, adSpend: 600, adSales: 1800, adOrders: 70,
  ...overrides,
});

describe("独立产品表现分析引擎", () => {
  it("应按既定阈值给产品划分销量等级", () => {
    expect(getSalesGrade(151)).toBe("S");
    expect(getSalesGrade(150)).toBe("A");
    expect(getSalesGrade(70)).toBe("B");
    expect(getSalesGrade(20)).toBe("E");
    expect(getSalesGrade(10)).toBe("F");
    expect(getSalesGrade(9)).toBe("X");
  });

  it("应计算广告费率、广告单占比、客单价、CPC与环比", () => {
    const result = analyzeProductPerformance([row({ units: 150, sales: 4500, adSpend: 900, adOrders: 90, orders: 180, clicks: 300 })], [row({ units: 100, sales: 3000, adSpend: 600, grossProfit: 700 })], "2026-07", "2026-06");
    const product = result.products[0]!;
    expect(product.adRate).toBeCloseTo(0.2, 5);
    expect(product.adOrderShare).toBeCloseTo(0.5, 5);
    expect(product.averageOrderValue).toBeCloseTo(25, 5);
    expect(product.cpc).toBeCloseTo(3, 5);
    expect(product.unitsChange).toBeCloseTo(0.5, 5);
    expect(product.salesChange).toBeCloseTo(0.5, 5);
  });

  it("应将负利润产品归入亏损榜，将高费率产品归入注意榜", () => {
    const result = analyzeProductPerformance([
      row({ asin: "B0LOSS", grossProfit: -50, profitMargin: -0.02, sales: 2000 }),
      row({ asin: "B0WARN", grossProfit: 600, profitMargin: 0.2, sales: 2000, adSpend: 700 }),
    ]);
    expect(result.products.find((item) => item.asin === "B0LOSS")?.status).toBe("loss");
    expect(result.products.find((item) => item.asin === "B0WARN")?.status).toBe("attention");
    expect(result.losses).toHaveLength(1);
    expect(result.attentions).toHaveLength(1);
  });

  it("不应将零销量且无广告花费的产品误判为亏损", () => {
    const result = analyzeProductPerformance([row({ asin: "B0ZERO", units: 0, sales: 0, orders: 0, grossProfit: 0, profitMargin: 0, adSpend: 0, adOrders: 0 })]);
    expect(result.products[0]?.status).toBe("normal");
    expect(result.losses).toHaveLength(0);
  });
});
