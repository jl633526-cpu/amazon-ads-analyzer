/**
 * 亚马逊广告报表解析引擎
 * 负责：报表类型识别、字段标准化、数据解析
 *
 * 支持两种数据源格式：
 * 1. 亚马逊后台原始报告（英文列名）
 * 2. 领星ERP导出报告（中文列名）
 *
 * 领星报告对应关系：
 *   广告活动报告     → Campaign Report
 *   商品投放报告     → Targeting Report
 *   用户搜索词报告   → Search Term Report
 *   广告（推广的商品）报告 → Advertised Product Report
 *   产品表现报告     → Business Report
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

// 负责人中文名 → code 映射（用于领星产品表现报告直接读取负责人列）
const OWNER_NAME_TO_CODE: Record<string, string> = {};
for (const o of OWNER_RULES) {
  OWNER_NAME_TO_CODE[o.name] = o.code;
}

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

// ============================================================
// 领星匹配方式 → 标准 Match Type 映射
// ============================================================
const LINGXING_MATCH_TYPE_MAP: Record<string, string> = {
  "紧密匹配": "EXACT",
  "广泛匹配": "BROAD",
  "词组匹配": "PHRASE",
  "同类商品": "TARGETING_EXPRESSION",
  "精准商品": "TARGETING_EXPRESSION",
  "自动投放": "AUTO",
  "手动投放": "MANUAL",
  "--": "UNKNOWN",
};

function normalizeLingxingMatchType(val: string | undefined): string {
  if (!val) return "UNKNOWN";
  return LINGXING_MATCH_TYPE_MAP[val.trim()] ?? val.trim();
}

// ============================================================
// 报表类型识别（同时支持亚马逊原始格式和领星格式）
// ============================================================
export function detectReportType(headers: string[]): ReportType {
  const headerSet = new Set(headers.map((h) => h.trim()));
  const hasHeader = (key: string) =>
    headerSet.has(key) || headers.some((h) => h.trim().includes(key));

  // ---- 领星格式识别 ----
  // 领星用户搜索词报告：含"用户搜索词"列
  if (hasHeader("用户搜索词")) {
    return "search_term_report";
  }

  // 领星商品投放报告：含"投放"列，不含"用户搜索词"列
  // 注意：领星商品投放报告没有"匹配方式"列，用"投放"列+无"用户搜索词"列区分
  if (hasHeader("投放") && !hasHeader("用户搜索词")) {
    return "targeting_report";
  }

  // 领星广告（推广的商品）报告：含"ASIN"列 + "MSKU"列
  if (hasHeader("MSKU") && hasHeader("ASIN") && hasHeader("广告活动")) {
    return "advertised_product_report";
  }

  // 领星广告活动报告：含"广告活动"列 + "有效状态"列
  if (hasHeader("广告活动") && hasHeader("有效状态")) {
    return "campaign_report";
  }

  // 领星产品表现报告：含"Sessions-Total"或"TACOS"列
  if (hasHeader("Sessions-Total") || hasHeader("TACOS") || hasHeader("负责人")) {
    return "business_report";
  }

  // ---- 亚马逊原始格式识别 ----
  // 1. Search Term Report — 唯一标识：Customer Search Term
  if (hasHeader("Customer Search Term")) {
    return "search_term_report";
  }

  // 2. Targeting Report — 唯一标识：Top-of-search Impression Share
  if (hasHeader("Top-of-search Impression Share") || hasHeader("Top-of-search")) {
    return "targeting_report";
  }

  // 3. Business Report — 唯一标识：会话数 或 Sessions - Total
  if (
    hasHeader("会话数 - 总计") ||
    hasHeader("Sessions - Total") ||
    headers.some((h) => h.includes("会话数"))
  ) {
    return "business_report";
  }

  // 4. Advertised Product Report — 唯一标识：Advertised SKU + Advertised ASIN
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
// 数值解析工具
// ============================================================
function parseNum(val: unknown): number | undefined {
  if (val === null || val === undefined || val === "") return undefined;
  const str = String(val).replace(/[$,\s%]/g, "");
  const n = parseFloat(str);
  return isNaN(n) ? undefined : n;
}

function parsePct(val: unknown): number | undefined {
  if (val === null || val === undefined || val === "") return undefined;
  const str = String(val).trim();
  // 领星特殊值处理：'有花费无销售额'、'有花费无订单'、'--' 等
  if (str === "有花费无销售额" || str === "有花费无订单" || str === "--" || str === "0%") {
    // "0%" 是真实的0，其他特殊值返回 undefined（无意义）
    if (str === "0%") return 0;
    return undefined;
  }
  const cleaned = str.replace(/[%\s]/g, "");
  const n = parseFloat(cleaned);
  if (isNaN(n)) return undefined;
  // 如果已经是小数形式（0.xx）则直接返回，否则除以100
  return n > 1 ? n / 100 : n;
}

// ============================================================
// 判断是否为领星格式（通过列名特征）
// ============================================================
function isLingxingFormat(headers: string[]): boolean {
  const headerSet = new Set(headers.map((h) => h.trim()));
  return (
    headerSet.has("店铺名称") ||
    headerSet.has("花费-本币") ||
    headerSet.has("广告销售额-本币") ||
    headerSet.has("ACoS") ||
    headerSet.has("匹配方式") ||
    headerSet.has("用户搜索词")
  );
}

// ============================================================
// 字段标准化映射
// ============================================================
function normalizeRow(raw: Record<string, unknown>, reportType: ReportType, lingxing: boolean): StandardRow {
  // 构建 trimmed key → value 的映射，解决列名末尾空格问题
  const trimmedRaw: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    trimmedRaw[k.trim()] = v;
  }

  const get = (keys: string[]): unknown => {
    for (const k of keys) {
      const trimK = k.trim();
      if (trimmedRaw[trimK] !== undefined && trimmedRaw[trimK] !== null && trimmedRaw[trimK] !== "") {
        return trimmedRaw[trimK];
      }
      // 包含匹配（处理列名带后缀的情况）
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

  const row: StandardRow = { report_type: reportType };

  if (lingxing) {
    // ============================================================
    // 领星格式解析
    // ============================================================
    if (reportType === "business_report") {
      // 领星产品表现报告
      row.asin = String(get(["ASIN", "父ASIN"]) ?? "");
      row.sku = String(get(["MSKU", "SKU"]) ?? "");
      // 领星产品表现报告直接有"负责人"列
      const ownerNameRaw = String(get(["负责人"]) ?? "");
      if (ownerNameRaw && OWNER_NAME_TO_CODE[ownerNameRaw]) {
        row.owner_name = ownerNameRaw;
        row.owner_code = OWNER_NAME_TO_CODE[ownerNameRaw];
      }
      row.sessions = parseNum(get(["Sessions-Total"]));
      row.page_views = parseNum(get(["PV-Total"]));
      row.br_cvr = parsePct(get(["CVR", "销量CVR"]));
      row.total_units = parseNum(get(["销量", "广告销量"]));
      row.total_sales = parseNum(get(["销售额", "广告销售额"]));
      row.buybox_pct = parsePct(get(["Buybox赢得率"]));
      row.spend = parseNum(get(["广告花费", "SP广告费"]));
      row.ad_sales = parseNum(get(["广告销售额", "SP广告销售额"]));
      row.acos = parsePct(get(["ACOS"]));
      row.ctr = parsePct(get(["CTR"]));
      row.cpc = parseNum(get(["CPC"]));
      row.roas = parseNum(get(["ROAS"]));
    } else if (reportType === "campaign_report") {
      // 领星广告活动报告
      row.campaign_name = String(get(["广告活动"]) ?? "");
      row.portfolio_name = String(get(["广告组合"]) ?? "");
      row.ad_group_name = String(get(["广告组"]) ?? "");
      row.status = String(get(["有效状态"]) ?? "");
      row.impressions = parseNum(get(["曝光量"]));
      row.clicks = parseNum(get(["点击"]));
      row.spend = parseNum(get(["花费-本币"]));
      row.ad_sales = parseNum(get(["广告销售额-本币"]));
      row.orders = parseNum(get(["广告订单"]));
      row.ctr = parsePct(get(["CTR"]));
      row.cpc = parseNum(get(["CPC-本币"]));
      row.acos = parsePct(get(["ACoS"]));
      row.roas = parseNum(get(["ROAS"]));
      row.ad_cvr = parsePct(get(["CVR"]));
    } else if (reportType === "targeting_report") {
      // 领星商品投放报告
      row.campaign_name = String(get(["广告活动"]) ?? "");
      row.portfolio_name = String(get(["广告组合"]) ?? "");
      row.ad_group_name = String(get(["广告组"]) ?? "");
      row.targeting = String(get(["投放"]) ?? "");
      const rawMatchType = String(get(["匹配方式"]) ?? "");
      row.match_type = normalizeLingxingMatchType(rawMatchType);
      row.impressions = parseNum(get(["曝光量"]));
      row.clicks = parseNum(get(["点击"]));
      row.spend = parseNum(get(["花费-本币"]));
      row.ad_sales = parseNum(get(["广告销售额-本币"]));
      row.orders = parseNum(get(["广告订单"]));
      row.ctr = parsePct(get(["CTR"]));
      row.cpc = parseNum(get(["CPC-本币"]));
      row.acos = parsePct(get(["ACoS"]));
      row.roas = parseNum(get(["ROAS"]));
      row.ad_cvr = parsePct(get(["CVR"]));
    } else if (reportType === "search_term_report") {
      // 领星用户搜索词报告
      row.campaign_name = String(get(["广告活动"]) ?? "");
      row.portfolio_name = String(get(["广告组合"]) ?? "");
      row.ad_group_name = String(get(["广告组"]) ?? "");
      row.targeting = String(get(["投放"]) ?? "");
      const rawMatchType = String(get(["匹配方式"]) ?? "");
      row.match_type = normalizeLingxingMatchType(rawMatchType);
      row.search_term = String(get(["用户搜索词"]) ?? "");
      row.impressions = parseNum(get(["曝光量"]));
      row.clicks = parseNum(get(["点击"]));
      row.spend = parseNum(get(["花费-本币"]));
      row.ad_sales = parseNum(get(["广告销售额-本币"]));
      row.orders = parseNum(get(["广告订单"]));
      row.ctr = parsePct(get(["CTR"]));
      row.cpc = parseNum(get(["CPC-本币"]));
      row.acos = parsePct(get(["ACoS"]));
      row.roas = parseNum(get(["ROAS"]));
      row.ad_cvr = parsePct(get(["CVR"]));
    } else if (reportType === "advertised_product_report") {
      // 领星广告（推广的商品）报告
      row.campaign_name = String(get(["广告活动"]) ?? "");
      row.portfolio_name = String(get(["广告组合"]) ?? "");
      row.ad_group_name = String(get(["广告组"]) ?? "");
      row.sku = String(get(["MSKU"]) ?? "");
      row.asin = String(get(["ASIN"]) ?? "");
      row.status = String(get(["广告有效状态"]) ?? "");
      row.impressions = parseNum(get(["曝光量"]));
      row.clicks = parseNum(get(["点击"]));
      row.spend = parseNum(get(["花费-本币"]));
      row.ad_sales = parseNum(get(["广告销售额-本币"]));
      row.orders = parseNum(get(["广告订单"]));
      row.ctr = parsePct(get(["CTR"]));
      row.cpc = parseNum(get(["CPC-本币"]));
      row.acos = parsePct(get(["ACoS"]));
      row.roas = parseNum(get(["ROAS"]));
      row.ad_cvr = parsePct(get(["CVR"]));
    }
  } else {
    // ============================================================
    // 亚马逊原始格式解析（保持原有逻辑不变）
    // ============================================================
    if (reportType === "business_report") {
      row.asin = String(get(["（子）ASIN", "子ASIN", "子 ASIN", "Child ASIN", "ASIN"]) ?? "");
      row.sku = String(get(["SKU"]) ?? "");
      row.sessions = parseNum(get(["会话数 - 总计", "Sessions - Total", "Sessions"]));
      row.page_views = parseNum(get(["页面浏览量 - 总计", "Page Views - Total", "Page Views"]));
      row.br_cvr = parsePct(get(["转化率 - 总计", "Unit Session Percentage - Total", "Unit Session Percentage", "商品会话百分比"]));
      row.total_units = parseNum(get(["已订购商品数量", "Units Ordered"]));
      row.total_sales = parseNum(get(["已订购商品销售额", "Ordered Product Sales"]));
      row.buybox_pct = parsePct(get([
        "推荐报价（推荐报价展示位）百分比",
        "推荐报价百分比",
        "Buy Box Percentage",
        "Featured Offer (Buy Box) Percentage"
      ]));
    } else if (reportType === "campaign_report") {
      row.campaign_name = String(get(["Campaign Name"]) ?? "");
      row.portfolio_name = String(get(["Portfolio name", "Portfolio Name"]) ?? "");
      row.status = String(get(["Status", "Campaign Status"]) ?? "");
      row.targeting_type = String(get(["Targeting Type"]) ?? "");
      row.bidding_strategy = String(get(["Bidding strategy"]) ?? "");
      row.budget = parseNum(get(["Budget Amount", "Budget"]));
      row.impressions = parseNum(get(["Impressions"]));
      row.clicks = parseNum(get(["Clicks"]));
      row.spend = parseNum(get(["Spend"]));
      row.ad_sales = parseNum(get(["7 Day Total Sales ($)", "7 Day Total Sales"]));
      row.orders = parseNum(get(["7 Day Total Orders (#)", "7 Day Total Orders"]));
      row.units = parseNum(get(["7 Day Total Units (#)", "7 Day Total Units"]));
      row.ctr = parsePct(get(["Click-Thru Rate (CTR)", "CTR"]));
      row.cpc = parseNum(get(["Cost Per Click (CPC)", "CPC"]));
      row.acos = parsePct(get(["Total Advertising Cost of Sales (ACOS) %", "Total Advertising Cost of Sales (ACOS)"]));
      row.roas = parseNum(get(["Total Return on Advertising Spend (ROAS)", "ROAS"]));
      row.ad_cvr = parsePct(get(["7 Day Conversion Rate", "Conversion Rate"]));
    } else if (reportType === "targeting_report") {
      row.campaign_name = String(get(["Campaign Name"]) ?? "");
      row.ad_group_name = String(get(["Ad Group Name"]) ?? "");
      row.targeting = String(get(["Targeting"]) ?? "");
      row.match_type = String(get(["Match Type"]) ?? "");
      row.impressions = parseNum(get(["Impressions"]));
      row.clicks = parseNum(get(["Clicks"]));
      row.spend = parseNum(get(["Spend"]));
      row.ad_sales = parseNum(get(["7 Day Total Sales ($)", "7 Day Total Sales"]));
      row.orders = parseNum(get(["7 Day Total Orders (#)", "7 Day Total Orders"]));
      row.units = parseNum(get(["7 Day Total Units (#)", "7 Day Total Units"]));
      row.ctr = parsePct(get(["Click-Thru Rate (CTR)", "CTR"]));
      row.cpc = parseNum(get(["Cost Per Click (CPC)", "CPC"]));
      row.acos = parsePct(get(["Total Advertising Cost of Sales (ACOS) %", "Total Advertising Cost of Sales (ACOS)"]));
      row.roas = parseNum(get(["Total Return on Advertising Spend (ROAS)", "ROAS"]));
      row.ad_cvr = parsePct(get(["7 Day Conversion Rate", "Conversion Rate"]));
      row.top_of_search_impression_share = parsePct(get(["Top-of-search Impression Share"]));
    } else if (reportType === "search_term_report") {
      row.campaign_name = String(get(["Campaign Name"]) ?? "");
      row.portfolio_name = String(get(["Portfolio name", "Portfolio Name"]) ?? "");
      row.ad_group_name = String(get(["Ad Group Name"]) ?? "");
      row.targeting = String(get(["Targeting"]) ?? "");
      row.match_type = String(get(["Match Type"]) ?? "");
      row.search_term = String(get(["Customer Search Term"]) ?? "");
      row.impressions = parseNum(get(["Impressions"]));
      row.clicks = parseNum(get(["Clicks"]));
      row.spend = parseNum(get(["Spend"]));
      row.ad_sales = parseNum(get(["7 Day Total Sales ($)", "7 Day Total Sales"]));
      row.orders = parseNum(get(["7 Day Total Orders (#)", "7 Day Total Orders"]));
      row.units = parseNum(get(["7 Day Total Units (#)", "7 Day Total Units"]));
      row.ctr = parsePct(get(["Click-Thru Rate (CTR)", "CTR"]));
      row.cpc = parseNum(get(["Cost Per Click (CPC)", "CPC"]));
      row.acos = parsePct(get(["Total Advertising Cost of Sales (ACOS) %", "Total Advertising Cost of Sales (ACOS)"]));
      row.roas = parseNum(get(["Total Return on Advertising Spend (ROAS)", "ROAS"]));
      row.ad_cvr = parsePct(get(["7 Day Conversion Rate", "Conversion Rate"]));
    } else if (reportType === "advertised_product_report") {
      row.campaign_name = String(get(["Campaign Name"]) ?? "");
      row.ad_group_name = String(get(["Ad Group Name"]) ?? "");
      row.sku = String(get(["Advertised SKU"]) ?? "");
      row.asin = String(get(["Advertised ASIN"]) ?? "");
      row.impressions = parseNum(get(["Impressions"]));
      row.clicks = parseNum(get(["Clicks"]));
      row.spend = parseNum(get(["Spend"]));
      row.ad_sales = parseNum(get(["7 Day Total Sales ($)", "7 Day Total Sales"]));
      row.orders = parseNum(get(["7 Day Total Orders (#)", "7 Day Total Orders"]));
      row.units = parseNum(get(["7 Day Total Units (#)", "7 Day Total Units"]));
      row.ctr = parsePct(get(["Click-Thru Rate (CTR)", "CTR"]));
      row.cpc = parseNum(get(["Cost Per Click (CPC)", "CPC"]));
      row.acos = parsePct(get(["Total Advertising Cost of Sales (ACOS) %", "Total Advertising Cost of Sales (ACOS)"]));
      row.roas = parseNum(get(["Total Return on Advertising Spend (ROAS)", "ROAS"]));
      row.ad_cvr = parsePct(get(["7 Day Conversion Rate", "Conversion Rate"]));
      row.advertised_sku_sales = parseNum(get(["7 Day Advertised SKU Sales", "Advertised SKU Sales"]));
      row.other_sku_sales = parseNum(get(["7 Day Other SKU Sales", "Other SKU Sales"]));
    }
  }

  // ============================================================
  // 计算缺失的衍生指标（通用，不区分格式）
  // ============================================================
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

  // ============================================================
  // 识别负责人
  // 领星产品表现报告已在上方直接读取，其他报告从 Campaign 名称解析
  // ============================================================
  if (!row.owner_code && row.campaign_name) {
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
  isLingxing?: boolean;
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

  const lingxing = isLingxingFormat(headers);
  const reportType = detectReportType(headers);
  const rows = rawRows.map((raw) => normalizeRow(raw, reportType, lingxing));

  return {
    reportType,
    rows,
    rowCount: rows.length,
    headers,
    isLingxing: lingxing,
  };
}
