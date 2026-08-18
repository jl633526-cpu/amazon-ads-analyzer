import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { buildProductAnalysisWorkbook } from "./productAnalysisExcelExport";

const result = {
  currentPeriod: "2026-07", priorPeriod: "2026-06",
  summary: { totalProducts: 2, totalUnits: 200, totalSales: 5000, totalAdSpend: 1000, totalGrossProfit: 1200 },
  ownerSummaries: [{ ownerName: "陈黎", productCount: 1, units: 160, sales: 4000, adSpend: 700, adRate: 0.175, grossProfit: 1000, profitMargin: 0.25, starCount: 1, lossCount: 0, attentionCount: 0 }],
  products: [
    { asin: "B0STAR", sku: "SKU1", title: "明星产品", ownerName: "陈黎", salesGrade: "S", units: 160, sales: 4000, orders: 150, adSpend: 700, adOrders: 80, adRate: 0.175, adOrderShare: 0.53, averageOrderValue: 26.7, cpc: 2.2, grossProfit: 1000, profitMargin: 0.25, status: "star", statusReason: "健康", suggestion: "放量", unitsChange: 0.2, salesChange: 0.3, adSpendChange: 0.1, profitChange: 0.2 },
    { asin: "B0LOSS", sku: "SKU2", title: "亏损产品", ownerName: "李彩华", salesGrade: "X", units: 2, sales: 100, orders: 4, adSpend: 300, adOrders: 1, adRate: 3, adOrderShare: 0.25, averageOrderValue: 25, cpc: 3, grossProfit: -50, profitMargin: -0.5, status: "loss", statusReason: "亏损", suggestion: "止损", unitsChange: -0.2, salesChange: -0.5, adSpendChange: 0.5, profitChange: -1 },
  ],
};

describe("产品表现Excel导出", () => {
  it("应生成总览、人员、全产品及三类Top榜工作表", () => {
    const workbook = buildProductAnalysisWorkbook(result, "测试任务");
    expect(workbook.SheetNames).toEqual(expect.arrayContaining(["导出说明", "人员维度", "全产品分析", "明星榜", "亏损榜", "注意榜"]));
    const products = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets["全产品分析"]);
    expect(products).toHaveLength(2);
    expect(products[0]?.["ASIN"]).toBe("B0STAR");
  });

  it("应在负责人筛选导出时过滤人员和全产品工作表", () => {
    const workbook = buildProductAnalysisWorkbook(result, "测试任务", "陈黎");
    const owners = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets["人员维度"]);
    const products = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets["全产品分析"]);
    expect(owners).toHaveLength(1);
    expect(products).toHaveLength(1);
    expect(products[0]?.["负责人"]).toBe("陈黎");
  });
});
