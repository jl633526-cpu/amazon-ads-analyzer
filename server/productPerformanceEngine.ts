import * as XLSX from "xlsx";

export type SalesGrade = "S" | "A" | "B" | "C" | "D" | "E" | "F" | "X";
export type ProductStatus = "star" | "loss" | "attention" | "normal";

export interface ProductSourceRow {
  asin: string;
  sku: string;
  store: string;
  ownerName: string;
  title: string;
  units: number;
  sales: number;
  orders: number;
  grossProfit: number | null;
  profitMargin: number | null;
  sessions: number;
  clicks: number;
  adSpend: number;
  adSales: number;
  adOrders: number;
}

export interface ProductPerformanceItem extends ProductSourceRow {
  key: string;
  averageOrderValue: number | null;
  adRate: number | null;
  adOrderShare: number | null;
  cpc: number | null;
  salesGrade: SalesGrade;
  status: ProductStatus;
  statusReason: string;
  suggestion: string;
  priorUnits: number | null;
  priorSales: number | null;
  priorAdSpend: number | null;
  priorGrossProfit: number | null;
  unitsChange: number | null;
  salesChange: number | null;
  adSpendChange: number | null;
  profitChange: number | null;
}

export interface ProductOwnerSummary {
  ownerName: string;
  productCount: number;
  units: number;
  sales: number;
  adSpend: number;
  grossProfit: number | null;
  adRate: number | null;
  profitMargin: number | null;
  starCount: number;
  lossCount: number;
  attentionCount: number;
}

export interface ProductPerformanceSummary {
  totalProducts: number;
  totalUnits: number;
  totalSales: number;
  totalOrders: number;
  totalAdSpend: number;
  totalAdOrders: number;
  totalGrossProfit: number | null;
  adRate: number | null;
  adOrderShare: number | null;
  averageOrderValue: number | null;
  cpc: number | null;
  profitMargin: number | null;
  hasProfitData: boolean;
  gradeCounts: Record<SalesGrade, number>;
  statusCounts: Record<ProductStatus, number>;
}

export interface ProductPerformanceResult {
  summary: ProductPerformanceSummary;
  ownerSummaries: ProductOwnerSummary[];
  products: ProductPerformanceItem[];
  stars: ProductPerformanceItem[];
  losses: ProductPerformanceItem[];
  attentions: ProductPerformanceItem[];
  currentPeriod: string | null;
  priorPeriod: string | null;
}

const GRADE_ORDER: SalesGrade[] = ["S", "A", "B", "C", "D", "E", "F", "X"];
const SALES_GRADES: Record<SalesGrade, { min: number; max: number | null }> = {
  S: { min: 151, max: null },
  A: { min: 100, max: 150 },
  B: { min: 70, max: 99 },
  C: { min: 50, max: 69 },
  D: { min: 35, max: 49 },
  E: { min: 20, max: 34 },
  F: { min: 10, max: 19 },
  X: { min: 0, max: 9 },
};

function numberValue(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (value === null || value === undefined) return 0;
  const text = String(value).trim();
  if (!text || text === "--" || text === "有花费无订单" || text === "有花费无销售额") return 0;
  const normalized = text.replace(/[,$￥¥\s]/g, "").replace(/%$/, "");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return 0;
  return text.includes("%") ? parsed / 100 : parsed;
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || String(value).trim() === "" || String(value).trim() === "--") return null;
  return numberValue(value);
}

function textValue(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

function headerValue(row: Record<string, unknown>, headers: string[]): unknown {
  for (const header of headers) {
    if (Object.prototype.hasOwnProperty.call(row, header)) return row[header];
  }
  return undefined;
}

function makeKey(row: ProductSourceRow): string {
  return `${row.store || "未命名店铺"}::${row.asin || row.sku || row.title || "未命名产品"}`;
}

export function inferPeriodFromFilename(filename: string): string | null {
  const matched = filename.match(/(20\d{2})[-年.](\d{1,2})/);
  return matched ? `${matched[1]}-${matched[2].padStart(2, "0")}` : null;
}

export function parseProductPerformanceBuffer(buffer: Buffer, filename = ""): { rows: ProductSourceRow[]; period: string | null } {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!firstSheet) throw new Error("未读取到产品表现工作表");
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: null, raw: true });
  const rows = rawRows.map((row) => ({
    asin: textValue(headerValue(row, ["ASIN", "asin"])),
    sku: textValue(headerValue(row, ["MSKU", "SKU", "sku"])),
    store: textValue(headerValue(row, ["店铺", "店铺名称", "Store"])),
    ownerName: textValue(headerValue(row, ["负责人", "运营负责人", "Owner"])) || "未分配",
    title: textValue(headerValue(row, ["标题", "品名", "商品标题", "Title"])),
    units: numberValue(headerValue(row, ["销量", "Units", "销售量"])),
    sales: numberValue(headerValue(row, ["销售额", "Sales", "销售额-本币"])),
    orders: numberValue(headerValue(row, ["订单量", "订单", "Orders"])),
    grossProfit: nullableNumber(headerValue(row, ["结算毛利润", "订单毛利润", "毛利润", "Gross Profit"])),
    profitMargin: nullableNumber(headerValue(row, ["结算毛利率", "订单毛利率", "毛利率", "Gross Margin"])),
    sessions: numberValue(headerValue(row, ["Sessions-Total", "Sessions", "会话"])),
    clicks: numberValue(headerValue(row, ["点击", "Clicks"])),
    adSpend: numberValue(headerValue(row, ["广告花费", "花费-本币", "广告费", "Ad Spend"])),
    adSales: numberValue(headerValue(row, ["广告销售额", "广告销售额-本币", "Ad Sales"])),
    adOrders: numberValue(headerValue(row, ["广告订单量", "广告订单", "Ad Orders"])),
  })).filter((row) => row.asin || row.sku || row.title);
  return { rows, period: inferPeriodFromFilename(filename) };
}

export function getSalesGrade(units: number): SalesGrade {
  if (units > 150) return "S";
  if (units >= 100) return "A";
  if (units >= 70) return "B";
  if (units >= 50) return "C";
  if (units >= 35) return "D";
  if (units >= 20) return "E";
  if (units >= 10) return "F";
  return "X";
}

function safeChange(current: number, prior: number | null): number | null {
  if (prior === null || prior === 0) return null;
  return (current - prior) / Math.abs(prior);
}

function diagnose(item: Omit<ProductPerformanceItem, "status" | "statusReason" | "suggestion">): Pick<ProductPerformanceItem, "status" | "statusReason" | "suggestion"> {
  if (item.grossProfit !== null && item.grossProfit < 0) {
    return { status: "loss", statusReason: `结算毛利润 ${item.grossProfit.toFixed(2)}，产品处于亏损`, suggestion: "立即复核成本、价格与折扣；暂停无效广告，并制定止损方案。" };
  }
  if (item.sales > 0 && item.profitMargin !== null && item.profitMargin < 0.1) {
    return { status: "loss", statusReason: `结算毛利率 ${(item.profitMargin * 100).toFixed(1)}%，低于10%止损线`, suggestion: "优先调整售价、成本或广告预算，避免规模放大亏损。" };
  }
  if (item.units > 150 && (item.profitMargin === null || item.profitMargin >= 0.2) && (item.adRate === null || item.adRate <= 0.22)) {
    return { status: "star", statusReason: `销量${item.units}，利润与广告费率均健康`, suggestion: "保障库存，稳定核心词预算，并复制有效投放结构。" };
  }
  if (item.sales <= 0 && item.adSpend >= 20) {
    return { status: "attention", statusReason: `无销售额但已产生广告花费 ${item.adSpend.toFixed(2)}`, suggestion: "暂停或降价无成交广告，检查库存、Buy Box与Listing可售状态。" };
  }
  if ((item.adRate !== null && item.adRate > 0.22) || (item.sales > 0 && item.profitMargin !== null && item.profitMargin < 0.2)) {
    const reason = item.adRate !== null && item.adRate > 0.22
      ? `广告费率 ${(item.adRate * 100).toFixed(1)}% 高于22%目标线`
      : `结算毛利率 ${((item.profitMargin ?? 0) * 100).toFixed(1)}% 低于20%目标线`;
    return { status: "attention", statusReason: reason, suggestion: "检查广告结构、折扣与采购成本，优先改善费率或利润率。" };
  }
  if (item.salesChange !== null && item.salesChange <= -0.25) {
    return { status: "attention", statusReason: `销售额环比 ${(item.salesChange * 100).toFixed(1)}%，下滑超过25%`, suggestion: "排查缺货、价格变化、排名与流量下降，制定恢复动作。" };
  }
  return { status: "normal", statusReason: "销量、费率和利润处于可观察范围", suggestion: "维持当前节奏，持续追踪销量等级和广告效率。" };
}

function total(rows: ProductPerformanceItem[], key: keyof ProductPerformanceItem): number {
  return rows.reduce((sum, row) => sum + (typeof row[key] === "number" ? row[key] as number : 0), 0);
}

function summarizeOwner(ownerName: string, rows: ProductPerformanceItem[]): ProductOwnerSummary {
  const units = total(rows, "units");
  const sales = total(rows, "sales");
  const adSpend = total(rows, "adSpend");
  const profitRows = rows.filter((row) => row.grossProfit !== null);
  const grossProfit = profitRows.length ? profitRows.reduce((sum, row) => sum + (row.grossProfit ?? 0), 0) : null;
  return {
    ownerName,
    productCount: rows.length,
    units,
    sales,
    adSpend,
    grossProfit,
    adRate: sales > 0 ? adSpend / sales : null,
    profitMargin: grossProfit !== null && sales > 0 ? grossProfit / sales : null,
    starCount: rows.filter((row) => row.status === "star").length,
    lossCount: rows.filter((row) => row.status === "loss").length,
    attentionCount: rows.filter((row) => row.status === "attention").length,
  };
}

export function analyzeProductPerformance(currentRows: ProductSourceRow[], priorRows: ProductSourceRow[] = [], currentPeriod: string | null = null, priorPeriod: string | null = null): ProductPerformanceResult {
  const priorMap = new Map(priorRows.map((row) => [makeKey(row), row]));
  const products = currentRows.map((row) => {
    const key = makeKey(row);
    const prior = priorMap.get(key);
    const base: Omit<ProductPerformanceItem, "status" | "statusReason" | "suggestion"> = {
      ...row,
      key,
      averageOrderValue: row.orders > 0 ? row.sales / row.orders : null,
      adRate: row.sales > 0 ? row.adSpend / row.sales : null,
      adOrderShare: row.orders > 0 ? row.adOrders / row.orders : null,
      cpc: row.clicks > 0 ? row.adSpend / row.clicks : null,
      salesGrade: getSalesGrade(row.units),
      priorUnits: prior ? prior.units : null,
      priorSales: prior ? prior.sales : null,
      priorAdSpend: prior ? prior.adSpend : null,
      priorGrossProfit: prior?.grossProfit ?? null,
      unitsChange: safeChange(row.units, prior?.units ?? null),
      salesChange: safeChange(row.sales, prior?.sales ?? null),
      adSpendChange: safeChange(row.adSpend, prior?.adSpend ?? null),
      profitChange: safeChange(row.grossProfit ?? 0, prior?.grossProfit ?? null),
    };
    return { ...base, ...diagnose(base) };
  }).sort((a, b) => b.sales - a.sales || b.units - a.units);

  const totalUnits = total(products, "units");
  const totalSales = total(products, "sales");
  const totalOrders = total(products, "orders");
  const totalAdSpend = total(products, "adSpend");
  const totalAdOrders = total(products, "adOrders");
  const totalClicks = total(products, "clicks");
  const profitRows = products.filter((row) => row.grossProfit !== null);
  const totalGrossProfit = profitRows.length ? profitRows.reduce((sum, row) => sum + (row.grossProfit ?? 0), 0) : null;
  const gradeCounts = Object.fromEntries(GRADE_ORDER.map((grade) => [grade, products.filter((row) => row.salesGrade === grade).length])) as Record<SalesGrade, number>;
  const statusCounts: Record<ProductStatus, number> = {
    star: products.filter((row) => row.status === "star").length,
    loss: products.filter((row) => row.status === "loss").length,
    attention: products.filter((row) => row.status === "attention").length,
    normal: products.filter((row) => row.status === "normal").length,
  };
  const ownerMap = new Map<string, ProductPerformanceItem[]>();
  products.forEach((row) => ownerMap.set(row.ownerName, [...(ownerMap.get(row.ownerName) ?? []), row]));
  const ownerSummaries = Array.from(ownerMap.entries()).map(([ownerName, rows]) => summarizeOwner(ownerName, rows)).sort((a, b) => b.sales - a.sales);

  return {
    summary: {
      totalProducts: products.length,
      totalUnits,
      totalSales,
      totalOrders,
      totalAdSpend,
      totalAdOrders,
      totalGrossProfit,
      adRate: totalSales > 0 ? totalAdSpend / totalSales : null,
      adOrderShare: totalOrders > 0 ? totalAdOrders / totalOrders : null,
      averageOrderValue: totalOrders > 0 ? totalSales / totalOrders : null,
      cpc: totalClicks > 0 ? totalAdSpend / totalClicks : null,
      profitMargin: totalGrossProfit !== null && totalSales > 0 ? totalGrossProfit / totalSales : null,
      hasProfitData: profitRows.length > 0,
      gradeCounts,
      statusCounts,
    },
    ownerSummaries,
    products,
    stars: products.filter((row) => row.status === "star").sort((a, b) => b.sales - a.sales).slice(0, 5),
    losses: products.filter((row) => row.status === "loss").sort((a, b) => (a.grossProfit ?? 0) - (b.grossProfit ?? 0)).slice(0, 5),
    attentions: products.filter((row) => row.status === "attention").sort((a, b) => (b.adRate ?? 0) - (a.adRate ?? 0) || (a.profitMargin ?? 1) - (b.profitMargin ?? 1)).slice(0, 5),
    currentPeriod,
    priorPeriod,
  };
}
