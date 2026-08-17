import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { parseReportBuffer } from "./reportParser";

function buildWorkbookBuffer(row: Record<string, unknown>): Buffer {
  const worksheet = XLSX.utils.json_to_sheet([row]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "sheet1");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

describe("领星ERP报表解析", () => {
  it("应识别产品表现报告，并直接读取负责人及业务指标", async () => {
    const result = await parseReportBuffer(buildWorkbookBuffer({
      ASIN: "B0LINGXING01",
      MSKU: "LK-CL-01",
      "负责人": "陈黎",
      "Sessions-Total": 1200,
      "PV-Total": 1800,
      CVR: "12.50%",
      "销量": 150,
      "销售额": 3500.5,
      "Buybox赢得率": "98.00%",
      "广告花费": 200,
    }), "产品表现.xlsx");

    expect(result.reportType).toBe("business_report");
    expect(result.rows[0]).toMatchObject({
      asin: "B0LINGXING01",
      sku: "LK-CL-01",
      sessions: 1200,
      page_views: 1800,
      br_cvr: 0.125,
      total_units: 150,
      total_sales: 3500.5,
      buybox_pct: 0.98,
      owner_code: "CL",
      owner_name: "陈黎",
    });
  });

  it("应识别广告活动报告并映射核心广告绩效", async () => {
    const result = await parseReportBuffer(buildWorkbookBuffer({
      "广告组合": "MT-CL-01",
      "广告活动": "MT-CL-SP-Exact",
      "有效状态": "enabled",
      "预算": 50,
      "曝光量": 10000,
      "点击": 120,
      CTR: "1.20%",
      "CPC-本币": 1.5,
      "花费-本币": 180,
      "广告销售额-本币": 600,
      ACoS: "30.00%",
      ROAS: 3.33,
      "广告订单": 24,
      CVR: "20.00%",
      "广告销量": 28,
    }), "广告活动报告-汇总.xlsx");

    expect(result.reportType).toBe("campaign_report");
    expect(result.rows[0]).toMatchObject({
      campaign_name: "MT-CL-SP-Exact",
      portfolio_name: "MT-CL-01",
      budget: 50,
      impressions: 10000,
      clicks: 120,
      spend: 180,
      ad_sales: 600,
      orders: 24,
      acos: 0.3,
      ad_cvr: 0.2,
      owner_code: "CL",
    });
  });

  it("应识别商品投放报告并将商品ASIN标准化为商品投放匹配类型", async () => {
    const result = await parseReportBuffer(buildWorkbookBuffer({
      "广告活动": "MT-CST-SP-PT",
      "广告组": "MT-CST-SP-PT",
      "投放": '商品:"B0TARGET01"',
      "有效状态": "enabled",
      "曝光量": 2000,
      "点击": 30,
      CTR: "1.50%",
      "花费-本币": 60,
      "广告销售额-本币": 200,
      ACoS: "30.00%",
      ROAS: 3.33,
      "广告订单": 6,
      CVR: "20.00%",
    }), "商品投放报告-汇总.xlsx");

    expect(result.reportType).toBe("targeting_report");
    expect(result.rows[0]).toMatchObject({
      targeting: '商品:"B0TARGET01"',
      match_type: "TARGETING_EXPRESSION",
      spend: 60,
      orders: 6,
      acos: 0.3,
      owner_code: "CST",
    });
  });

  it("应识别用户搜索词报告，缺失匹配方式时按紧密匹配归类为自动匹配", async () => {
    const result = await parseReportBuffer(buildWorkbookBuffer({
      "广告活动": "MT-CST-SP-A（紧密）",
      "广告组": "MT-CST-SP-A（紧密）",
      "关键词": "紧密匹配",
      "匹配方式": "--",
      "投放": "紧密匹配",
      "用户搜索词": "magnesium supplement",
      "曝光量": 500,
      "点击": 20,
      CTR: "4.00%",
      "花费-本币": 25,
      "广告销售额-本币": 100,
      "广告订单": 4,
      CVR: "20.00%",
    }), "用户搜索词报告-汇总.xlsx");

    expect(result.reportType).toBe("search_term_report");
    expect(result.rows[0]).toMatchObject({
      search_term: "magnesium supplement",
      targeting: "紧密匹配",
      match_type: "AUTO",
      spend: 25,
      orders: 4,
      owner_code: "CST",
    });
  });

  it("应识别推广商品报告并映射ASIN、MSKU及直接/间接销售额", async () => {
    const result = await parseReportBuffer(buildWorkbookBuffer({
      "广告组合": "MT-HST-01",
      "广告活动": "MT-HST-SP-PT",
      "广告组": "MT-HST-SP-PT",
      "广告名称": "商品广告",
      ASIN: "B0PRODUCT01",
      MSKU: "SKU-PRODUCT-01",
      "广告有效状态": "enabled",
      "广告组投放类型": "商品投放",
      "曝光量": 8000,
      "点击": 80,
      CTR: "1.00%",
      "花费-本币": 120,
      "广告销售额-本币": 480,
      "直接销售额-本币": 400,
      "间接销售额-本币": 80,
      ACoS: "25.00%",
      ROAS: 4,
      "广告订单": 16,
      CVR: "20.00%",
    }), "广告（推广的商品）报告-汇总.xlsx");

    expect(result.reportType).toBe("advertised_product_report");
    expect(result.rows[0]).toMatchObject({
      asin: "B0PRODUCT01",
      sku: "SKU-PRODUCT-01",
      spend: 120,
      ad_sales: 480,
      advertised_sku_sales: 400,
      other_sku_sales: 80,
      acos: 0.25,
      owner_code: "HST",
    });
  });
});
