/**
 * 亚马逊广告报表解析引擎
 * 负责：报表类型识别、字段标准化、数据解析
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
      // 匹配 -CODE- 或 -CODE( 或 -CODE_ 或结尾 -CODE
      const pattern = new RegExp(
        `-${code}(-|\\(|_|$)`,
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
// 报表类型识别
// ============================================================
const REPORT_TYPE_SIGNATURES: Record<ReportType, string[]> = {
  business_report: [
    "会话数",
    "转化率",
    "已订购商品销售额",
    "推荐报价百分比",
    "Sessions - Total",
    "Unit Session Percentage",
    "Ordered Product Sales",
    "Buy Box Percentage",
  ],
  campaign_report: [
    "Campaign Name",
    "Bidding strategy",
    "Budget",
    "Targeting Type",
    "Portfolio name",
  ],
  targeting_report: [
    "Campaign Name",
    "Ad Group Name",
    "Targeting",
    "Match Type",
    "Top-of-search",
  ],
  search_term_report: [
    "Customer Search Term",
    "Search Term",
    "Campaign Name",
    "Ad Group Name",
    "Match Type",
  ],
  advertised_product_report: [
    "Advertised SKU",
    "Advertised ASIN",
    "Other SKU Sales",
    "Advertised SKU Sales",
  ],
  unknown: [],
};

export function detectReportType(headers: string[]): ReportType {
  const headerSet = new Set(headers.map((h) => h.trim()));

  // 优先检查唯一字段
  if (
    headerSet.has("Customer Search Term") ||
    headers.some((h) => h.includes("Customer Search Term"))
  ) {
    return "search_term_report";
  }
  if (
    headerSet.has("Advertised SKU") ||
    headers.some((h) => h.includes("Advertised SKU"))
  ) {
    return "advertised_product_report";
  }
  if (
    headerSet.has("会话数 - 总计") ||
    headerSet.has("Sessions - Total") ||
    headers.some((h) => h.includes("会话数") || h.includes("Sessions - Total"))
  ) {
    return "business_report";
  }
  if (
    headerSet.has("Top-of-search Impression Share") ||
    headers.some((h) => h.includes("Top-of-search"))
  ) {
    return "targeting_report";
  }
  if (
    headerSet.has("Bidding strategy") ||
    headerSet.has("Targeting Type") ||
    headers.some((h) => h.includes("Bidding strategy"))
  ) {
    return "campaign_report";
  }

  // 按签名匹配
  let bestType: ReportType = "unknown";
  let bestScore = 0;
  for (const [type, sigs] of Object.entries(REPORT_TYPE_SIGNATURES) as [
    ReportType,
    string[]
  ][]) {
    if (type === "unknown") continue;
    const score = sigs.filter((sig) =>
      headers.some((h) => h.includes(sig))
    ).length;
    if (score > bestScore) {
      bestScore = score;
      bestType = type;
    }
  }
  return bestType;
}

// ============================================================
// 字段标准化映射
// ============================================================
function parseNum(val: unknown): number | undefined {
  if (val === null || val === undefined || val === "") return undefined;
  const str = String(val).replace(/[$,\s%]/g, "");
  const n = parseFloat(str);
  return isNaN(n) ? undefined : n;
}

function parsePct(val: unknown): number | undefined {
  if (val === null || val === undefined || val === "") return undefined;
  const str = String(val).replace(/[%\s]/g, "");
  const n = parseFloat(str);
  if (isNaN(n)) return undefined;
  // 如果已经是小数形式（0.xx）则直接返回，否则除以100
  return n > 1 ? n / 100 : n;
}

function normalizeRow(raw: Record<string, unknown>, reportType: ReportType): StandardRow {
  const get = (keys: string[]): unknown => {
    for (const k of keys) {
      if (raw[k] !== undefined && raw[k] !== null && raw[k] !== "") return raw[k];
    }
    return undefined;
  };

  const row: StandardRow = { report_type: reportType };

  if (reportType === "business_report") {
    row.asin = String(get(["子ASIN", "子 ASIN", "Child ASIN", "ASIN"]) ?? "");
    row.sku = String(get(["SKU", "Parent ASIN", "父ASIN"]) ?? "");
    row.sessions = parseNum(get(["会话数 - 总计", "Sessions - Total", "Sessions"]));
    row.page_views = parseNum(get(["页面浏览量 - 总计", "Page Views - Total", "Page Views"]));
    row.br_cvr = parsePct(get(["转化率 - 总计", "Unit Session Percentage - Total", "Unit Session Percentage"]));
    row.total_units = parseNum(get(["已订购商品数量", "Units Ordered", "Units Ordered - B2B"]));
    row.total_sales = parseNum(get(["已订购商品销售额", "Ordered Product Sales", "Ordered Product Sales - B2B"]));
    row.buybox_pct = parsePct(get(["推荐报价百分比", "Buy Box Percentage", "Featured Offer (Buy Box) Percentage"]));
  } else if (reportType === "campaign_report") {
    row.campaign_name = String(get(["Campaign Name"]) ?? "");
    row.portfolio_name = String(get(["Portfolio name", "Portfolio Name"]) ?? "");
    row.status = String(get(["Status", "Campaign Status"]) ?? "");
    row.targeting_type = String(get(["Targeting Type"]) ?? "");
    row.bidding_strategy = String(get(["Bidding strategy"]) ?? "");
    row.budget = parseNum(get(["Budget"]));
    row.impressions = parseNum(get(["Impressions"]));
    row.clicks = parseNum(get(["Clicks"]));
    row.spend = parseNum(get(["Spend"]));
    row.ad_sales = parseNum(get(["7 Day Total Sales ($)", "7 Day Total Sales", "Sales"]));
    row.orders = parseNum(get(["7 Day Total Orders (#)", "7 Day Total Orders", "Orders"]));
    row.units = parseNum(get(["7 Day Total Units (#)", "7 Day Total Units", "Units"]));
    row.ctr = parsePct(get(["Click-Thru Rate (CTR)", "CTR"]));
    row.cpc = parseNum(get(["Cost Per Click (CPC)", "CPC"]));
    row.acos = parsePct(get(["Total Advertising Cost of Sales (ACOS) %", "Total Advertising Cost of Sales (ACOS)", "ACOS"]));
    row.roas = parseNum(get(["Total Return on Advertising Spend (ROAS)", "ROAS"]));
    row.ad_cvr = parsePct(get(["7 Day Conversion Rate", "Conversion Rate", "CVR"]));
  } else if (reportType === "targeting_report") {
    row.campaign_name = String(get(["Campaign Name"]) ?? "");
    row.ad_group_name = String(get(["Ad Group Name"]) ?? "");
    row.targeting = String(get(["Targeting"]) ?? "");
    row.match_type = String(get(["Match Type"]) ?? "");
    row.impressions = parseNum(get(["Impressions"]));
    row.clicks = parseNum(get(["Clicks"]));
    row.spend = parseNum(get(["Spend"]));
    row.ad_sales = parseNum(get(["7 Day Total Sales ($)", "7 Day Total Sales", "Sales"]));
    row.orders = parseNum(get(["7 Day Total Orders (#)", "7 Day Total Orders", "Orders"]));
    row.units = parseNum(get(["7 Day Total Units (#)", "7 Day Total Units", "Units"]));
    row.ctr = parsePct(get(["Click-Thru Rate (CTR)", "CTR"]));
    row.cpc = parseNum(get(["Cost Per Click (CPC)", "CPC"]));
    row.acos = parsePct(get(["Total Advertising Cost of Sales (ACOS) %", "Total Advertising Cost of Sales (ACOS)", "ACOS"]));
    row.roas = parseNum(get(["Total Return on Advertising Spend (ROAS)", "ROAS"]));
    row.ad_cvr = parsePct(get(["7 Day Conversion Rate", "Conversion Rate", "CVR"]));
    row.top_of_search_impression_share = parsePct(get(["Top-of-search Impression Share"]));
  } else if (reportType === "search_term_report") {
    row.campaign_name = String(get(["Campaign Name"]) ?? "");
    row.ad_group_name = String(get(["Ad Group Name"]) ?? "");
    row.targeting = String(get(["Targeting"]) ?? "");
    row.match_type = String(get(["Match Type"]) ?? "");
    row.search_term = String(get(["Customer Search Term"]) ?? "");
    row.impressions = parseNum(get(["Impressions"]));
    row.clicks = parseNum(get(["Clicks"]));
    row.spend = parseNum(get(["Spend"]));
    row.ad_sales = parseNum(get(["7 Day Total Sales ($)", "7 Day Total Sales", "Sales"]));
    row.orders = parseNum(get(["7 Day Total Orders (#)", "7 Day Total Orders", "Orders"]));
    row.units = parseNum(get(["7 Day Total Units (#)", "7 Day Total Units", "Units"]));
    row.ctr = parsePct(get(["Click-Thru Rate (CTR)", "CTR"]));
    row.cpc = parseNum(get(["Cost Per Click (CPC)", "CPC"]));
    row.acos = parsePct(get(["Total Advertising Cost of Sales (ACOS) %", "Total Advertising Cost of Sales (ACOS)", "ACOS"]));
    row.roas = parseNum(get(["Total Return on Advertising Spend (ROAS)", "ROAS"]));
    row.ad_cvr = parsePct(get(["7 Day Conversion Rate", "Conversion Rate", "CVR"]));
  } else if (reportType === "advertised_product_report") {
    row.campaign_name = String(get(["Campaign Name"]) ?? "");
    row.ad_group_name = String(get(["Ad Group Name"]) ?? "");
    row.sku = String(get(["Advertised SKU"]) ?? "");
    row.asin = String(get(["Advertised ASIN"]) ?? "");
    row.impressions = parseNum(get(["Impressions"]));
    row.clicks = parseNum(get(["Clicks"]));
    row.spend = parseNum(get(["Spend"]));
    row.ad_sales = parseNum(get(["7 Day Total Sales ($)", "7 Day Total Sales", "Sales"]));
    row.orders = parseNum(get(["7 Day Total Orders (#)", "7 Day Total Orders", "Orders"]));
    row.units = parseNum(get(["7 Day Total Units (#)", "7 Day Total Units", "Units"]));
    row.ctr = parsePct(get(["Click-Thru Rate (CTR)", "CTR"]));
    row.cpc = parseNum(get(["Cost Per Click (CPC)", "CPC"]));
    row.acos = parsePct(get(["Total Advertising Cost of Sales (ACOS) %", "Total Advertising Cost of Sales (ACOS)", "ACOS"]));
    row.roas = parseNum(get(["Total Return on Advertising Spend (ROAS)", "ROAS"]));
    row.ad_cvr = parsePct(get(["7 Day Conversion Rate", "Conversion Rate", "CVR"]));
    row.advertised_sku_sales = parseNum(get(["7 Day Advertised SKU Units (#)", "Advertised SKU Sales"]));
    row.other_sku_sales = parseNum(get(["7 Day Other SKU Units (#)", "Other SKU Sales"]));
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

  // 识别负责人
  if (row.campaign_name) {
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
