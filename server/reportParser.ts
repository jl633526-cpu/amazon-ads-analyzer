/**
 * 亚马逊广告报表解析引擎
 * 负责：报表类型识别、字段标准化、数据解析
 * 
 * 修复记录（2026-07-09）：
 * 1. 报表类型识别顺序：Search Term > Targeting > Business > Advertised Product > Campaign
 * 2. 字段名末尾空格：所有 get() 查找时对 raw 的 key 做 trim 处理
 * 3. Campaign Report 预算列：Budget Amount
 * 4. Business Report 字段：（子）ASIN、转化率 - 总计、推荐报价（推荐报价展示位）百分比
 */
import * as XLSX from "xlsx";
import Papa from "papaparse";

export type ReportType =
  | "business_report"
  | "campaign_report"
  | "targeting_report"
  | "search_term_report"
  | "advertised_product_report"
  | "unknown";

export interface StandardRow {
  // Campaign级别
  campaign_name?: string;
  portfolio_name?: string;
  ad_group_name?: string;
  status?: string;
  targeting_type?: string;
  bidding_strategy?: string;
  budget?: number;
  // 投放词
  targeting?: string;
  match_type?: string;
  search_term?: string;
  // 商品
  sku?: string;
  asin?: string;
  // 核心指标
  impressions?: number;
  clicks?: number;
  spend?: number;
  ad_sales?: number;
  orders?: number;
  units?: number;
  ctr?: number;
  cpc?: number;
  acos?: number;
  roas?: number;
  ad_cvr?: number;
  // Business Report
  sessions?: number;
  br_cvr?: number;
  total_sales?: number;
  total_units?: number;
  buybox_pct?: number;
  page_views?: number;
  // Advertised Product
  advertised_sku_sales?: number;
  other_sku_sales?: number;
  // Top of search
  top_of_search_impression_share?: number;
  // 衍生字段
  owner_code?: string;
  owner_name?: string;
  report_type?: ReportType;
}

// ============================================================
// 负责人识别规则（严格按照Excel模板定义）
// 优先级：CL1(1) > LCH(2) > HST(3) > HYD(4) > LLT(5) > CST(6) > SLJ(7) > LY(8) > CL(9) > SR(10)
// ============================================================
export const OWNER_RULES: Array<{
  code: string;
  name: string;
  priority: number;
}> = [
  { code: "CL1", name: "曹力", priority: 1 },
  { code: "LCH", name: "李彩华", priority: 2 },
  { code: "HST", name: "黄舒婷", priority: 3 },
  { code: "HYD", name: "胡宜东", priority: 4 },
  { code: "LLT", name: "罗丽婷", priority: 5 },
  { code: "CST", name: "陈诗婷", priority: 6 },
  { code: "SLJ", name: "孙琳洁", priority: 7 },
  { code: "LY", name: "李艳", priority: 8 },
  { code: "CL", name: "陈黎", priority: 9 },
  { code: "SR", name: "申荣", priority: 10 },
];

// 按优先级排序（数字越小越优先）
const SORTED_OWNERS = [...OWNER_RULES].sort((a, b) => a.priority - b.priority);

/**
 * 从 Campaign Name 中识别负责人
 * 规则：识别 '-CODE-'、'-CODE('、'-CODE_' 或结尾 '-CODE'
 * CL1 必须先于 CL 匹配
 */
export function identifyOwner(campaignName: string, portfolioName?: string): {
  ownerCode: string;
  ownerName: string;
} {
  const UNKNOWN = { ownerCode: "UNKNOWN", ownerName: "未识别" };
  if (!campaignName && !portfolioName) return UNKNOWN;
  const sources = [campaignName, portfolioName].filter(Boolean) as string[];

  for (const source of sources) {
    for (const owner of SORTED_OWNERS) {
      const code = owner.code;
      // 匹配模式：-CODE- | -CODE( | -CODE_ | -CODE结尾 | _CODE- | _CODE结尾
      const pattern = new RegExp(
        `[-_]${code}[-_(]|[-_]${code}$|^${code}[-_]`,
        "i"
      );
      if (pattern.test(source)) {
        return { ownerCode: owner.code, ownerName: owner.name };
      }
    }
  }
  return UNKNOWN;
}

/** 领星产品表现报告提供中文负责人列，优先直接使用。 */
function identifyOwnerFromDirectName(ownerName: string): { ownerCode: string; ownerName: string } {
  const normalizedName = ownerName.trim();
  const knownOwner = OWNER_RULES.find((owner) => owner.name === normalizedName);
  if (knownOwner) return { ownerCode: knownOwner.code, ownerName: knownOwner.name };
  return normalizedName
    ? { ownerCode: `DIRECT_${normalizedName}`, ownerName: normalizedName }
    : { ownerCode: "UNKNOWN", ownerName: "未识别" };
}

/** 将领星与亚马逊的匹配方式统一为既有分析引擎可识别的标准值。 */
function normalizeMatchTypeValue(value: unknown): string {
  const raw = String(value ?? "").trim();
  const upper = raw.toUpperCase();
  if (!raw || raw === "--" || raw === "-") return "";
  if (upper === "EXACT" || raw.includes("精准") || raw.includes("精确")) return "EXACT";
  if (upper === "PHRASE" || raw.includes("短语") || raw.includes("词组")) return "PHRASE";
  if (upper === "BROAD" || raw.includes("广泛")) return "BROAD";
  if (upper.startsWith("TARGETING_EXPRESSION") || raw.startsWith("商品:") || raw.startsWith("ASIN:")) return "TARGETING_EXPRESSION";
  if (upper === "AUTO" || raw.includes("紧密") || raw.includes("宽泛") || raw.includes("关联") || raw.includes("替代")) return "AUTO";
  return raw;
}

// ============================================================
// 报表类型识别
// ============================================================
export function detectReportType(headers: string[]): ReportType {
  // 使用 trim 后的 headerSet 进行精确匹配
  const headerSet = new Set(headers.map((h) => h.trim()));
  const hasHeader = (key: string) =>
    headerSet.has(key) || headers.some((h) => h.trim().includes(key));

  // 领星ERP格式：先按中文唯一列识别，避免与原始亚马逊格式互相误判。
  if (hasHeader("用户搜索词")) return "search_term_report";
  if (hasHeader("广告名称") && hasHeader("ASIN") && hasHeader("广告活动")) return "advertised_product_report";
  if (hasHeader("投放") && hasHeader("广告活动") && !hasHeader("用户搜索词") && !hasHeader("广告名称")) return "targeting_report";
  if (hasHeader("广告活动") && hasHeader("预算")) return "campaign_report";
  if (hasHeader("负责人") && (hasHeader("Sessions-Total") || hasHeader("广告花费"))) return "business_report";

  // 1. Search Term Report — 唯一标识：Customer Search Term
  if (hasHeader("Customer Search Term")) {
    return "search_term_report";
  }

  // 2. Targeting Report — 唯一标识：Top-of-search Impression Share + Targeting + Match Type
  //    注意：必须在 Advertised Product 之前检查，因为 Targeting Report 也含 "7 Day Advertised SKU Units"
  if (hasHeader("Top-of-search Impression Share") || hasHeader("Top-of-search")) {
    return "targeting_report";
  }

  // 3. Business Report — 唯一标识：中文会话数 或 Sessions - Total
  if (
    hasHeader("会话数 - 总计") ||
    hasHeader("Sessions - Total") ||
    headers.some((h) => h.includes("会话数"))
  ) {
    return "business_report";
  }

  // 4. Advertised Product Report — 唯一标识：Advertised SKU + Advertised ASIN（精确列名，非包含）
  if (headerSet.has("Advertised SKU") || headerSet.has("Advertised ASIN")) {
    return "advertised_product_report";
  }

  // 5. Campaign Report — 唯一标识：Bidding strategy 或 Targeting Type
  if (hasHeader("Bidding strategy") || hasHeader("Targeting Type")) {
    return "campaign_report";
  }

  return "unknown";
}

// ============================================================
// 字段标准化映射
// ============================================================
function parseNum(val: unknown): number | undefined {
  if (val === null || val === undefined || val === "") return undefined;
  const original = String(val).trim();
  if (!original || original === "--" || original === "-" || original.includes("无销售额")) return undefined;
  const str = original.replace(/[$,\s%]/g, "");
  const n = parseFloat(str);
  return isNaN(n) ? undefined : n;
}

function parsePct(val: unknown): number | undefined {
  if (val === null || val === undefined || val === "") return undefined;
  const original = String(val).trim();
  if (!original || original === "--" || original === "-" || original.includes("无销售额")) return undefined;
  const str = original.replace(/[%\s]/g, "");
  const n = parseFloat(str);
  if (isNaN(n)) return undefined;
  // 如果已经是小数形式（0.xx）则直接返回，否则除以100
  return n > 1 ? n / 100 : n;
}

function normalizeRow(raw: Record<string, unknown>, reportType: ReportType): StandardRow {
  // 构建 trimmed key → original key 的映射，解决列名末尾空格问题
  const trimmedRaw: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    trimmedRaw[k.trim()] = v;
  }

  const get = (keys: string[]): unknown => {
    for (const k of keys) {
      const trimK = k.trim();
      // 先精确匹配 trimmed key
      if (trimmedRaw[trimK] !== undefined && trimmedRaw[trimK] !== null && trimmedRaw[trimK] !== "") {
        return trimmedRaw[trimK];
      }
      // 再做包含匹配（处理列名带后缀空格的情况）
      for (const [rawKey, rawVal] of Object.entries(trimmedRaw)) {
        if (rawKey.includes(trimK) || trimK.includes(rawKey)) {
          if (rawVal !== undefined && rawVal !== null && rawVal !== "") {
            return rawVal;
          }
        }
      }
    }
    return undefined;
  };

  // 用于“Buybox赢得率”等可能被模糊匹配到相邻字段的指标。
  const getExact = (keys: string[]): unknown => {
    for (const key of keys) {
      const value = trimmedRaw[key.trim()];
      if (value !== undefined && value !== null && value !== "") return value;
    }
    return undefined;
  };

  const row: StandardRow = { report_type: reportType };

  if (reportType === "business_report") {
    // Business Report 使用中文列名
    row.asin = String(get(["（子）ASIN", "子ASIN", "子 ASIN", "Child ASIN", "ASIN"]) ?? "");
    row.sku = String(get(["MSKU", "SKU"]) ?? "");
    row.sessions = parseNum(get(["Sessions-Total", "会话数 - 总计", "Sessions - Total", "Sessions"]));
    row.page_views = parseNum(get(["PV-Total", "页面浏览量 - 总计", "Page Views - Total", "Page Views"]));
    row.br_cvr = parsePct(get(["CVR", "转化率 - 总计", "Unit Session Percentage - Total", "Unit Session Percentage", "商品会话百分比"]));
    row.total_units = parseNum(get(["销量", "已订购商品数量", "Units Ordered"]));
    row.total_sales = parseNum(get(["销售额", "已订购商品销售额", "Ordered Product Sales"]));
    row.buybox_pct = parsePct(getExact([
      "推荐报价（推荐报价展示位）百分比",
      "推荐报价百分比",
      "Buy Box Percentage",
      "Featured Offer (Buy Box) Percentage",
      "Buybox赢得率"
    ]));
  } else if (reportType === "campaign_report") {
    row.campaign_name = String(get(["广告活动", "Campaign Name"]) ?? "");
    row.portfolio_name = String(get(["广告组合", "Portfolio name", "Portfolio Name"]) ?? "");
    row.status = String(get(["有效状态", "Status", "Campaign Status"]) ?? "");
    row.targeting_type = String(get(["广告组投放类型", "Targeting Type"]) ?? "");
    row.bidding_strategy = String(get(["Bidding strategy"]) ?? "");
    row.budget = parseNum(get(["预算", "Budget Amount", "Budget"]));
    row.impressions = parseNum(get(["曝光量", "Impressions"]));
    row.clicks = parseNum(get(["点击", "Clicks"]));
    row.spend = parseNum(get(["花费-本币", "Spend"]));
    row.ad_sales = parseNum(get(["广告销售额-本币", "7 Day Total Sales ($)", "7 Day Total Sales"]));
    row.orders = parseNum(get(["广告订单", "7 Day Total Orders (#)", "7 Day Total Orders"]));
    row.units = parseNum(get(["广告销量", "7 Day Total Units (#)", "7 Day Total Units"]));
    row.ctr = parsePct(get(["Click-Thru Rate (CTR)", "CTR"]));
    row.cpc = parseNum(get(["Cost Per Click (CPC)", "CPC"]));
    row.acos = parsePct(get(["ACoS", "Total Advertising Cost of Sales (ACOS) %", "Total Advertising Cost of Sales (ACOS)"]));
    row.roas = parseNum(get(["Total Return on Advertising Spend (ROAS)", "ROAS"]));
    row.ad_cvr = parsePct(get(["CVR", "7 Day Conversion Rate", "Conversion Rate"]));
  } else if (reportType === "targeting_report") {
    row.campaign_name = String(get(["广告活动", "Campaign Name"]) ?? "");
    row.portfolio_name = String(get(["广告组合", "Portfolio name", "Portfolio Name"]) ?? "");
    row.ad_group_name = String(get(["广告组", "Ad Group Name"]) ?? "");
    row.targeting = String(get(["投放", "Targeting"]) ?? "");
    row.status = String(get(["有效状态", "Status"]) ?? "");
    const targetingMatchType = normalizeMatchTypeValue(get(["匹配方式", "Match Type"]));
    row.match_type = targetingMatchType || normalizeMatchTypeValue(row.targeting) || normalizeMatchTypeValue(row.campaign_name);
    row.impressions = parseNum(get(["曝光量", "Impressions"]));
    row.clicks = parseNum(get(["点击", "Clicks"]));
    row.spend = parseNum(get(["花费-本币", "Spend"]));
    row.ad_sales = parseNum(get(["广告销售额-本币", "7 Day Total Sales ($)", "7 Day Total Sales"]));
    row.orders = parseNum(get(["广告订单", "7 Day Total Orders (#)", "7 Day Total Orders"]));
    row.units = parseNum(get(["广告销量", "7 Day Total Units (#)", "7 Day Total Units"]));
    row.ctr = parsePct(get(["Click-Thru Rate (CTR)", "CTR"]));
    row.cpc = parseNum(get(["Cost Per Click (CPC)", "CPC"]));
    row.acos = parsePct(get(["ACoS", "Total Advertising Cost of Sales (ACOS) %", "Total Advertising Cost of Sales (ACOS)"]));
    row.roas = parseNum(get(["Total Return on Advertising Spend (ROAS)", "ROAS"]));
    row.ad_cvr = parsePct(get(["CVR", "7 Day Conversion Rate", "Conversion Rate"]));
    row.top_of_search_impression_share = parsePct(get(["Top-of-search Impression Share"]));
  } else if (reportType === "search_term_report") {
    row.campaign_name = String(get(["广告活动", "Campaign Name"]) ?? "");
    row.portfolio_name = String(get(["广告组合", "Portfolio name", "Portfolio Name"]) ?? "");
    row.ad_group_name = String(get(["广告组", "Ad Group Name"]) ?? "");
    row.targeting = String(get(["投放", "关键词", "Targeting"]) ?? "");
    const searchTermMatchType = normalizeMatchTypeValue(get(["匹配方式", "Match Type"]));
    row.match_type = searchTermMatchType || normalizeMatchTypeValue(row.targeting);
    row.search_term = String(get(["用户搜索词", "Customer Search Term"]) ?? "");
    row.impressions = parseNum(get(["曝光量", "Impressions"]));
    row.clicks = parseNum(get(["点击", "Clicks"]));
    row.spend = parseNum(get(["花费-本币", "Spend"]));
    row.ad_sales = parseNum(get(["广告销售额-本币", "7 Day Total Sales ($)", "7 Day Total Sales"]));
    row.orders = parseNum(get(["广告订单", "7 Day Total Orders (#)", "7 Day Total Orders"]));
    row.units = parseNum(get(["广告销量", "7 Day Total Units (#)", "7 Day Total Units"]));
    row.ctr = parsePct(get(["Click-Thru Rate (CTR)", "CTR"]));
    row.cpc = parseNum(get(["Cost Per Click (CPC)", "CPC"]));
    row.acos = parsePct(get(["ACoS", "Total Advertising Cost of Sales (ACOS) %", "Total Advertising Cost of Sales (ACOS)"]));
    row.roas = parseNum(get(["Total Return on Advertising Spend (ROAS)", "ROAS"]));
    row.ad_cvr = parsePct(get(["CVR", "7 Day Conversion Rate", "Conversion Rate"]));
  } else if (reportType === "advertised_product_report") {
    row.campaign_name = String(get(["广告活动", "Campaign Name"]) ?? "");
    row.portfolio_name = String(get(["广告组合", "Portfolio name", "Portfolio Name"]) ?? "");
    row.ad_group_name = String(get(["广告组", "Ad Group Name"]) ?? "");
    row.status = String(get(["广告有效状态", "有效状态", "Status"]) ?? "");
    row.targeting_type = String(get(["广告组投放类型", "Targeting Type"]) ?? "");
    row.sku = String(get(["MSKU", "Advertised SKU"]) ?? "");
    row.asin = String(get(["ASIN", "Advertised ASIN"]) ?? "");
    row.impressions = parseNum(get(["曝光量", "Impressions"]));
    row.clicks = parseNum(get(["点击", "Clicks"]));
    row.spend = parseNum(get(["花费-本币", "Spend"]));
    row.ad_sales = parseNum(get(["广告销售额-本币", "7 Day Total Sales ($)", "7 Day Total Sales"]));
    row.orders = parseNum(get(["广告订单", "7 Day Total Orders (#)", "7 Day Total Orders"]));
    row.units = parseNum(get(["广告销量", "7 Day Total Units (#)", "7 Day Total Units"]));
    row.ctr = parsePct(get(["Click-Thru Rate (CTR)", "CTR"]));
    row.cpc = parseNum(get(["Cost Per Click (CPC)", "CPC"]));
    row.acos = parsePct(get(["ACoS", "Total Advertising Cost of Sales (ACOS) %", "Total Advertising Cost of Sales (ACOS)"]));
    row.roas = parseNum(get(["Total Return on Advertising Spend (ROAS)", "ROAS"]));
    row.ad_cvr = parsePct(get(["CVR", "7 Day Conversion Rate", "Conversion Rate"]));
    row.advertised_sku_sales = parseNum(get(["直接销售额-本币", "7 Day Advertised SKU Sales", "Advertised SKU Sales"]));
    row.other_sku_sales = parseNum(get(["间接销售额-本币", "7 Day Other SKU Sales", "Other SKU Sales"]));
  }

  // 计算缺失的衍生指标
  if (row.clicks && row.impressions && !row.ctr) {
    row.ctr = row.clicks / row.impressions;
  }
  if (row.spend && row.clicks && !row.cpc) {
    row.cpc = row.spend / row.clicks;
  }
  if (row.spend && row.ad_sales && !row.acos) {
    row.acos = row.spend / row.ad_sales;
  }
  if (row.ad_sales && row.spend && !row.roas) {
    row.roas = row.ad_sales / row.spend;
  }
  if (row.orders && row.clicks && !row.ad_cvr) {
    row.ad_cvr = row.orders / row.clicks;
  }

  // 负责人：领星产品表现报告的中文负责人列优先，其余报告按既有Campaign命名规则识别。
  const directOwnerName = String(get(["负责人"]) ?? "").trim();
  if (directOwnerName) {
    const owner = identifyOwnerFromDirectName(directOwnerName);
    row.owner_code = owner.ownerCode;
    row.owner_name = owner.ownerName;
  } else if (row.campaign_name) {
    const owner = identifyOwner(row.campaign_name, row.portfolio_name);
    row.owner_code = owner.ownerCode;
    row.owner_name = owner.ownerName;
  }

  return row;
}

// ============================================================
// 文件解析入口
// ============================================================
export interface ParseResult {
  reportType: ReportType;
  rows: StandardRow[];
  rowCount: number;
  headers: string[];
}

export async function parseReportBuffer(
  buffer: Buffer,
  filename: string
): Promise<ParseResult> {
  const ext = filename.toLowerCase().split(".").pop();
  let rawRows: Record<string, unknown>[] = [];
  let headers: string[] = [];

  if (ext === "csv") {
    const text = buffer.toString("utf-8");
    const result = Papa.parse<Record<string, unknown>>(text, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
    });
    rawRows = result.data;
    headers = result.meta.fields ?? [];
  } else if (ext === "xlsx" || ext === "xls") {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
    });
    rawRows = jsonData;
    if (jsonData.length > 0) {
      headers = Object.keys(jsonData[0]);
    }
  }

  const reportType = detectReportType(headers);
  const rows = rawRows.map((raw) => normalizeRow(raw, reportType));

  return {
    reportType,
    rows,
    rowCount: rows.length,
    headers,
  };
}
