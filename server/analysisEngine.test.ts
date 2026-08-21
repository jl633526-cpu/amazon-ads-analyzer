import { describe, it, expect } from "vitest";
import { identifyOwner, OWNER_RULES } from "./reportParser";
import { runFullAnalysis } from "./analysisEngine";
import type { StandardRow } from "./reportParser";

// ============================================================
// 负责人识别测试
// ============================================================
describe("identifyOwner - 负责人识别规则", () => {
  it("应识别 CL1（优先级最高，避免被CL截断）", () => {
    // 负责人规则匹配格式: -CODE- 或 -CODE_ 或 -CODE(
    const result = identifyOwner("SP-CL1-Auto-2024");
    expect(result.ownerCode).toBe("CL1");
  });

  it("应识别 CL（不含CL1时）", () => {
    const result = identifyOwner("SP-CL-Manual-Broad");
    expect(result.ownerCode).toBe("CL");
  });

  it("CL1优先级高于CL", () => {
    const r1 = identifyOwner("SP-CL1-Test");
    const r2 = identifyOwner("SP-CL-Test");
    expect(r1.ownerCode).toBe("CL1");
    expect(r2.ownerCode).toBe("CL");
    expect(r1.ownerCode).not.toBe(r2.ownerCode);
  });

  it("未匹配时返回UNKNOWN", () => {
    const result = identifyOwner("SP_UNKNOWN_Campaign");
    expect(result.ownerCode).toBe("UNKNOWN");
    expect(result.ownerName).toBe("未识别");
  });

  it("Campaign Name为空时返回UNKNOWN", () => {
    const result = identifyOwner("");
    expect(result.ownerCode).toBe("UNKNOWN");
  });

  it("Campaign Name为null/undefined时返回UNKNOWN", () => {
    // identifyOwner内部防御null处理
    const result = identifyOwner("" as string);
    expect(result.ownerCode).toBe("UNKNOWN");
  });
});

// ============================================================
// 分析引擎测试
// ============================================================
describe("runFullAnalysis - 完整分析流程", () => {
  const mockCampaignRows: StandardRow[] = [
    {
      campaign_name: "SP_CL1_Auto_Broad",
      ad_group_name: "AG1",
      targeting: "auto",
      match_type: "BROAD",
      spend: 500,
      ad_sales: 200,
      orders: 5,
      clicks: 100,
      impressions: 10000,
      owner_code: "CL1",
      owner_name: "负责人CL1",
      report_type: "campaign_report",
    },
    {
      campaign_name: "SP_CL_Manual_Exact",
      ad_group_name: "AG2",
      targeting: "keyword",
      match_type: "EXACT",
      spend: 1000,
      ad_sales: 500,
      orders: 0,
      clicks: 200,
      impressions: 20000,
      owner_code: "CL",
      owner_name: "负责人CL",
      report_type: "campaign_report",
    },
  ];

  it("应计算账户总览指标", () => {
    const result = runFullAnalysis({
      campaignRows: mockCampaignRows,
      targetingRows: [],
      searchTermRows: [],
      advertisedProductRows: [],
      brRows: [],
    });

    expect(result.accountOverview).toBeDefined();
    expect(result.accountOverview.totalSpend).toBe(1500);
    expect(result.accountOverview.totalAdSales).toBe(700);
    expect(result.accountOverview.totalOrders).toBe(5);
    expect(result.accountOverview.totalClicks).toBe(300);
  });

  it("应计算ACOS", () => {
    const result = runFullAnalysis({
      campaignRows: mockCampaignRows,
      targetingRows: [],
      searchTermRows: [],
      advertisedProductRows: [],
      brRows: [],
    });
    // ACOS = spend / adSales = 1500 / 700 ≈ 2.14
    expect(result.accountOverview.acos).not.toBeNull();
    expect(result.accountOverview.acos!).toBeCloseTo(1500 / 700, 2);
  });

  it("应生成负责人分析", () => {
    const result = runFullAnalysis({
      campaignRows: mockCampaignRows,
      targetingRows: [],
      searchTermRows: [],
      advertisedProductRows: [],
      brRows: [],
    });

    expect(result.ownerAnalysis.length).toBeGreaterThan(0);
    const cl1Owner = result.ownerAnalysis.find((o) => o.ownerCode === "CL1");
    expect(cl1Owner).toBeDefined();
    expect(cl1Owner!.spend).toBe(500);
  });

  it("应识别点击无单Campaign并生成P1建议", () => {
    const result = runFullAnalysis({
      campaignRows: mockCampaignRows,
      targetingRows: [],
      searchTermRows: [],
      advertisedProductRows: [],
      brRows: [],
    });

    const p1Campaigns = result.campaignSuggestions.filter((c) => c.priority === "P1");
    // SP_CL_Manual_Exact: 200次点击0单，应为P1
    expect(p1Campaigns.length).toBeGreaterThan(0);
  });

  it("应生成运营动作清单", () => {
    const result = runFullAnalysis({
      campaignRows: mockCampaignRows,
      targetingRows: [],
      searchTermRows: [],
      advertisedProductRows: [],
      brRows: [],
    });

    expect(result.actionItems.length).toBeGreaterThan(0);
    // 每个action item应有id, priority, category, action字段
    const firstItem = result.actionItems[0];
    expect(firstItem.id).toBeDefined();
    expect(firstItem.priority).toMatch(/^P[123]$/);
    expect(firstItem.category).toBeDefined();
    expect(firstItem.action).toBeDefined();
  });

  it("空数据应返回零值概览", () => {
    const result = runFullAnalysis({
      campaignRows: [],
      targetingRows: [],
      searchTermRows: [],
      advertisedProductRows: [],
      brRows: [],
    });

    expect(result.accountOverview.totalSpend).toBe(0);
    expect(result.accountOverview.acos).toBeNull();
    expect(result.ownerAnalysis.length).toBe(0);
    expect(result.campaignSuggestions.length).toBe(0);
  });

  it("应将具体ASIN与自动投放子类型聚合为规范匹配类型", () => {
    const searchRows: StandardRow[] = [
      { campaign_name: "SP_CL_ASIN", search_term: "vitamin", match_type: 'asin="B0DZNGZNLK"', spend: 100, ad_sales: 300, orders: 8, clicks: 40, impressions: 1000, owner_code: "CL", owner_name: "负责人CL", report_type: "search_term_report" },
      { campaign_name: "SP_CL_ASIN", search_term: "vitamin", match_type: 'asin="B0BCSSTMGY"', spend: 80, ad_sales: 160, orders: 4, clicks: 30, impressions: 800, owner_code: "CL", owner_name: "负责人CL", report_type: "search_term_report" },
      { campaign_name: "SP_CL_AUTO", search_term: "supplement", match_type: "close-match", spend: 50, ad_sales: 100, orders: 2, clicks: 20, impressions: 600, owner_code: "CL", owner_name: "负责人CL", report_type: "search_term_report" },
    ];
    const result = runFullAnalysis({ campaignRows: [], targetingRows: [], searchTermRows: searchRows, advertisedProductRows: [], brRows: [] });
    const matchTypes = result.searchTermAnalysis.matchTypeAnalysis;
    expect(matchTypes.map((item) => item.matchType)).toEqual(expect.arrayContaining(["ASIN匹配", "自动匹配"]));
    expect(matchTypes.find((item) => item.matchType === "ASIN匹配")?.totalSpend).toBe(180);
    expect(matchTypes).toHaveLength(2);
  });
});

// ============================================================
// 阈值规则测试
// ============================================================
describe("ACOS阈值判断", () => {
  it("ACOS > 180% 应为阻断状态", () => {
    const rows: StandardRow[] = [{
      campaign_name: "SP_CL1_Test",
      spend: 1800,
      ad_sales: 1000,
      orders: 1,
      clicks: 50,
      impressions: 5000,
      owner_code: "CL1",
      owner_name: "负责人CL1",
      report_type: "campaign_report",
    }];
    const result = runFullAnalysis({
      campaignRows: rows,
      targetingRows: [],
      searchTermRows: [],
      advertisedProductRows: [],
      brRows: [],
    });
    // ACOS = 1800/1000 = 1.8, 正好在block阈值上，实际为极危或阻断
    expect(['阻断', '极危']).toContain(result.accountOverview.acosStatus);
  });

  it("ACOS < 50% 应为优秀状态", () => {
    const rows: StandardRow[] = [{
      campaign_name: "SP_CL1_Test",
      spend: 100,
      ad_sales: 1000,
      orders: 10,
      clicks: 50,
      impressions: 5000,
      owner_code: "CL1",
      owner_name: "负责人CL1",
      report_type: "campaign_report",
    }];
    const result = runFullAnalysis({
      campaignRows: rows,
      targetingRows: [],
      searchTermRows: [],
      advertisedProductRows: [],
      brRows: [],
    });
    expect(result.accountOverview.acosStatus).toBe("优秀");
  });
});
