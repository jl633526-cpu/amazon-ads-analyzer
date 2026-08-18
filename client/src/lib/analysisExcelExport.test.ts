import * as XLSX from "xlsx";
import { describe, expect, it, vi } from "vitest";
import { buildAnalysisWorkbook, downloadAnalysisWorkbook } from "./analysisExcelExport";

const result = {
  accountOverview: {
    totalSpend: 300, totalAdSales: 1000, totalSales: 1500, totalNaturalSales: 500,
    totalOrders: 30, totalClicks: 200, totalImpressions: 12000, totalSessions: 900,
    acos: 0.3, roas: 3.33, tacos: 0.2, ctr: 0.0167, cvr: 0.15, cpc: 1.5,
    adSalesShare: 0.67, naturalSalesShare: 0.33, campaignCount: 2, activeCampaignCount: 2,
    ownerCount: 2, acosStatus: "优秀", cvrStatus: "及格", ctrStatus: "优秀",
  },
  ownerAnalysis: [
    { rank: 1, ownerCode: "CL", ownerName: "陈黎", spend: 100, adSales: 500, orders: 12, clicks: 60, impressions: 5000, acos: 0.2, roas: 5, ctr: 0.012, cvr: 0.2, cpc: 1.67, wasteSpend: 20, wasteRate: 0.2, campaignCount: 1, acosStatus: "优秀", cvrStatus: "优秀" },
    { rank: 2, ownerCode: "CST", ownerName: "陈诗婷", spend: 200, adSales: 500, orders: 18, clicks: 140, impressions: 7000, acos: 0.4, roas: 2.5, ctr: 0.02, cvr: 0.13, cpc: 1.43, wasteSpend: 30, wasteRate: 0.15, campaignCount: 1, acosStatus: "优秀", cvrStatus: "风险" },
  ],
  campaignSuggestions: [
    { priority: "P1", campaignName: "MT-CL-Campaign", ownerCode: "CL", ownerName: "陈黎", spend: 100, adSales: 500, orders: 12, clicks: 60, acos: 0.2, ctr: 0.012, cvr: 0.2, cpc: 1.67, issues: ["测试问题"], actions: ["测试动作"], acosStatus: "优秀" },
  ],
  targetingSuggestions: [],
  productPerformanceAnalysis: {
    products: [{ asin: "B0PRODUCT01", sku: "SKU-CL-01", ownerCode: "CL", ownerName: "陈黎", sessions: 1000, pageViews: 1200, units: 200, totalSales: 3000, brCvr: 0.2, buyboxPct: 0.95, adSpend: 300, adSales: 1200, adOrders: 80, acos: 0.25, tacos: 0.1, adSalesShare: 0.4, label: "high_potential", labelReason: "测试", recommendation: "扩大流量" }],
  },
  searchTermLists: {
    negateList: [{ searchTerm: "test term", targeting: "test", matchType: "BROAD", campaignName: "MT-CL-Campaign", adGroupName: "Group", ownerCode: "CL", ownerName: "陈黎", clicks: 25, spend: 10, orders: 0, acos: null, reason: "测试原因", action: "否定短语" }],
    toExactList: [], amplifyList: [],
  },
  searchTermAnalysis: {
    highValueTerms: [{ searchTerm: "test term", wordCategory: "generic", label: "high_value", labelReason: "测试", totalImpressions: 1000, totalClicks: 20, totalSpend: 10, totalSales: 100, totalOrders: 4, acos: 0.1, ctr: 0.02, cvr: 0.2, cpc: 0.5, campaignCount: 1, campaigns: ["MT-CL-Campaign"], matchTypes: ["BROAD"], ownerNames: ["陈黎"] }],
    lossTerms: [], invalidTerms: [], potentialTerms: [], topTermsBySpend: [], wordRootAnalysis: [], matchTypeAnalysis: [],
  },
  actionItems: [{ id: "ACT-001", priority: "P1", category: "Campaign优化", ownerCode: "CL", ownerName: "陈黎", target: "MT-CL-Campaign", issue: "测试问题", action: "测试动作", metrics: "花费$100" }],
};

describe("分析结果Excel导出", () => {
  it("应生成完整的多工作表工作簿", () => {
    const workbook = buildAnalysisWorkbook({ result, taskName: "测试任务" });
    expect(workbook.SheetNames).toEqual(expect.arrayContaining([
      "导出说明", "账户总览", "负责人分析", "Campaign建议", "Targeting建议",
      "产品表现", "高价值词", "词根分析", "匹配类型", "否词建议", "运营动作",
    ]));
    const overview = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets["账户总览"]);
    expect(overview).toEqual(expect.arrayContaining([expect.objectContaining({ "指标": "总花费", "数值": 300 })]));
  });

  it("应按选中负责人过滤负责人、建议和搜索词工作表", () => {
    const workbook = buildAnalysisWorkbook({ result, taskName: "测试任务", ownerCode: "CL", ownerName: "陈黎" });
    const owners = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets["负责人分析"]);
    const campaigns = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets["Campaign建议"]);
    const products = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets["产品表现"]);
    const searchTerms = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets["高价值词"]);
    expect(owners).toHaveLength(1);
    expect(owners[0]?.["负责人"]).toBe("陈黎");
    expect(campaigns).toHaveLength(1);
    expect(products).toHaveLength(1);
    expect(products[0]?.["负责人"]).toBe("陈黎");
    expect(searchTerms).toHaveLength(1);
    expect(workbook.SheetNames).toContain("词根分析（全量）");
  });

  it("应按规范文件名调用XLSX下载函数", () => {
    const writeFile = vi.fn();
    const filename = downloadAnalysisWorkbook(
      { result, taskName: "测试/任务", ownerCode: "CL", ownerName: "陈黎" },
      writeFile,
    );
    expect(filename).toBe("亚马逊广告分析汇总_测试_任务_陈黎.xlsx");
    expect(writeFile).toHaveBeenCalledWith(expect.anything(), filename, { compression: true });
  });
});
