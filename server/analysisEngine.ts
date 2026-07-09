/**
 * 亚马逊广告分析引擎
 * 负责：指标计算、规则判断、报告生成
 * 规则来源：Excel模板《广告分析智能体搭建模板_负责人规则更新》
 */
import type { StandardRow } from "./reportParser";

// ============================================================
// 阈值参数（来自 11_阈值参数设置 和 10_待补充规则）
// ============================================================
export const THRESHOLDS = {
  cvr: {
    excellent: 0.20,   // ≥20% 优秀
    good: 0.18,        // 15%-18% 中等
    pass: 0.15,        // ≥15% 及格
    warning: 0.12,     // 12%-15% 风险
    critical: 0.10,    // <12% 严重，<10% 特别严重
  },
  ctr: {
    excellent: 0.010,  // ≥1.0% 优秀
    good: 0.006,       // 0.4%-0.6% 中等
    pass: 0.004,       // ≥0.4% 及格
    warning: 0.002,    // 0.2%-0.4% 注意
    critical: 0.001,   // <0.1% 问题
  },
  acos: {
    excellent: 0.50,   // <50% 优秀
    normal: 0.70,      // 60%-70% 正常
    warning: 1.00,     // 80%-100% 预警
    danger: 1.20,      // ≥120% 高危
    extreme: 1.50,     // ≥150% 极危
    block: 1.80,       // >180% 阻断
  },
  clicks_no_order: 20, // Clicks > 20 且 Orders = 0 → 建议否词（固定规则）
  loss_per_order: 8,   // 每单亏损 > $8 → 亏损红线
};

// ============================================================
// 账户总览计算
// ============================================================
export interface AccountOverview {
  totalSpend: number;
  totalAdSales: number;
  totalOrders: number;
  totalClicks: number;
  totalImpressions: number;
  totalSessions: number;
  totalNaturalSales: number;
  totalSales: number;
  acos: number | null;
  roas: number | null;
  tacos: number | null;
  ctr: number | null;
  cvr: number | null;
  cpc: number | null;
  adSalesShare: number | null;
  naturalSalesShare: number | null;
  campaignCount: number;
  activeCampaignCount: number;
  ownerCount: number;
  // 健康状态
  acosStatus: string;
  cvrStatus: string;
  ctrStatus: string;
}

export function calcAccountOverview(
  campaignRows: StandardRow[],
  brRows: StandardRow[]
): AccountOverview {
  const totalSpend = sum(campaignRows, "spend");
  const totalAdSales = sum(campaignRows, "ad_sales");
  const totalOrders = sum(campaignRows, "orders");
  const totalClicks = sum(campaignRows, "clicks");
  const totalImpressions = sum(campaignRows, "impressions");
  const totalSessions = sum(brRows, "sessions");
  const totalSalesFromBR = sum(brRows, "total_sales");

  const acos = totalAdSales > 0 ? totalSpend / totalAdSales : null;
  const roas = totalSpend > 0 ? totalAdSales / totalSpend : null;
  const tacos = totalSalesFromBR > 0 ? totalSpend / totalSalesFromBR : null;
  const ctr = totalImpressions > 0 ? totalClicks / totalImpressions : null;
  const cvr = totalClicks > 0 ? totalOrders / totalClicks : null;
  const cpc = totalClicks > 0 ? totalSpend / totalClicks : null;

  const totalNaturalSales = Math.max(0, totalSalesFromBR - totalAdSales);
  const adSalesShare = totalSalesFromBR > 0 ? totalAdSales / totalSalesFromBR : null;
  const naturalSalesShare = totalSalesFromBR > 0 ? totalNaturalSales / totalSalesFromBR : null;

  const campaignNames = new Set(campaignRows.map((r) => r.campaign_name).filter(Boolean));
  const ownerCodes = new Set(campaignRows.map((r) => r.owner_code).filter(Boolean));

  return {
    totalSpend,
    totalAdSales,
    totalOrders,
    totalClicks,
    totalImpressions,
    totalSessions,
    totalNaturalSales,
    totalSales: totalSalesFromBR,
    acos,
    roas,
    tacos,
    ctr,
    cvr,
    cpc,
    adSalesShare,
    naturalSalesShare,
    campaignCount: campaignNames.size,
    activeCampaignCount: campaignRows.filter((r) => r.status?.toLowerCase() === "enabled").length,
    ownerCount: ownerCodes.size,
    acosStatus: getAcosStatus(acos),
    cvrStatus: getCvrStatus(cvr),
    ctrStatus: getCtrStatus(ctr),
  };
}

// ============================================================
// 负责人绩效分析
// ============================================================
export interface OwnerMetrics {
  ownerCode: string;
  ownerName: string;
  spend: number;
  adSales: number;
  orders: number;
  clicks: number;
  impressions: number;
  acos: number | null;
  roas: number | null;
  ctr: number | null;
  cvr: number | null;
  cpc: number | null;
  wasteSpend: number;   // 无订单花费
  wasteRate: number | null;
  campaignCount: number;
  acosStatus: string;
  cvrStatus: string;
  rank?: number;
}

export function calcOwnerAnalysis(campaignRows: StandardRow[]): OwnerMetrics[] {
  const ownerMap = new Map<string, StandardRow[]>();
  for (const row of campaignRows) {
    const key = row.owner_code ?? "UNKNOWN";
    if (!ownerMap.has(key)) ownerMap.set(key, []);
    ownerMap.get(key)!.push(row);
  }

  const metrics: OwnerMetrics[] = [];
  for (const [code, rows] of Array.from(ownerMap.entries())) {
    const spend = sum(rows, "spend");
    const adSales = sum(rows, "ad_sales");
    const orders = sum(rows, "orders");
    const clicks = sum(rows, "clicks");
    const impressions = sum(rows, "impressions");
    const wasteSpend = rows
      .filter((r) => (r.orders ?? 0) === 0)
      .reduce((s: number, r: StandardRow) => s + (r.spend ?? 0), 0);

    const acos = adSales > 0 ? spend / adSales : null;
    const roas = spend > 0 ? adSales / spend : null;
    const ctr = impressions > 0 ? clicks / impressions : null;
    const cvr = clicks > 0 ? orders / clicks : null;
    const cpc = clicks > 0 ? spend / clicks : null;
    const wasteRate = spend > 0 ? wasteSpend / spend : null;

    const campaigns = new Set(rows.map((r: StandardRow) => r.campaign_name).filter(Boolean));

    metrics.push({
      ownerCode: code,
      ownerName: rows[0]?.owner_name ?? "未识别",
      spend,
      adSales,
      orders,
      clicks,
      impressions,
      acos,
      roas,
      ctr,
      cvr,
      cpc,
      wasteSpend,
      wasteRate,
      campaignCount: campaigns.size,
      acosStatus: getAcosStatus(acos),
      cvrStatus: getCvrStatus(cvr),
    });
  }

  // 按花费降序排名
  metrics.sort((a, b) => b.spend - a.spend);
  metrics.forEach((m, i) => (m.rank = i + 1));
  return metrics;
}

// ============================================================
// Campaign 优化建议
// ============================================================
export interface CampaignSuggestion {
  campaignName: string;
  ownerCode: string;
  ownerName: string;
  spend: number;
  adSales: number;
  orders: number;
  acos: number | null;
  ctr: number | null;
  cvr: number | null;
  issues: string[];
  actions: string[];
  priority: "P1" | "P2" | "P3";
  acosStatus: string;
}

export function calcCampaignSuggestions(campaignRows: StandardRow[]): CampaignSuggestion[] {
  const campaignMap = new Map<string, StandardRow[]>();
  for (const row of campaignRows) {
    const key = row.campaign_name ?? "UNKNOWN";
    if (!campaignMap.has(key)) campaignMap.set(key, []);
    campaignMap.get(key)!.push(row);
  }

  const suggestions: CampaignSuggestion[] = [];
  for (const [name, rows] of Array.from(campaignMap.entries())) {
    const spend = sum(rows, "spend");
    const adSales = sum(rows, "ad_sales");
    const orders = sum(rows, "orders");
    const clicks = sum(rows, "clicks");
    const impressions = sum(rows, "impressions");
    const acos = adSales > 0 ? spend / adSales : null;
    const ctr = impressions > 0 ? clicks / impressions : null;
    const cvr = clicks > 0 ? orders / clicks : null;

    const issues: string[] = [];
    const actions: string[] = [];
    let priority: "P1" | "P2" | "P3" = "P3";

    // R006: ACOS红线判断
    if (acos !== null) {
      if (acos > THRESHOLDS.acos.block) {
        issues.push(`ACOS极度超标 ${pct(acos)}（阻断线 >180%）`);
        actions.push("立即暂停或大幅降低出价，进入P1清理清单");
        priority = "P1";
      } else if (acos >= THRESHOLDS.acos.extreme) {
        issues.push(`ACOS极危 ${pct(acos)}（极危线 ≥150%）`);
        actions.push("重点复盘，暂停低效投放词，拆分观察");
        priority = "P1";
      } else if (acos >= THRESHOLDS.acos.danger) {
        issues.push(`ACOS高危 ${pct(acos)}（高危线 ≥120%）`);
        actions.push("暂停或拆分低效词，降低出价");
        priority = "P1";
      } else if (acos >= THRESHOLDS.acos.warning) {
        issues.push(`ACOS预警 ${pct(acos)}（预警线 80%-100%）`);
        actions.push("降低出价/控预算，观察转化，不盲目扩量");
                if ((priority as string) !== "P1") priority = "P2";
      }
    }
    // 点击无单 Campaign
    if (clicks >= THRESHOLDS.clicks_no_order && orders === 0) {
      issues.push(`Campaign整体点击${clicks}次，0单`);
      actions.push("检查Listing承接，优先否定无效词，降低出价");
      priority = "P1";
    }

    // R008: CVR过低
    if (cvr !== null && cvr < THRESHOLDS.cvr.critical) {
      issues.push(`CVR严重偏低 ${pct(cvr)}（红线 <10%）`);
      actions.push("暂停扩量，优先优化主图/价格/评价/Coupon/详情页");
      priority = "P1";
    } else if (cvr !== null && cvr < THRESHOLDS.cvr.warning) {
      issues.push(`CVR偏低 ${pct(cvr)}（预警 12%-15%）`);
      actions.push("检查Listing承接质量，优化转化要素");
      if (priority !== "P1") priority = "P2";
    }

    // R007: CTR过低
    if (ctr !== null && ctr < THRESHOLDS.ctr.critical) {
      issues.push(`CTR极低 ${pct(ctr)}（问题线 <0.1%）`);
      actions.push("检查关键词相关性，优化主图/标题/价格，考虑否定无效流量");
      priority = "P1";
    } else if (ctr !== null && ctr < THRESHOLDS.ctr.warning) {
      issues.push(`CTR偏低 ${pct(ctr)}（注意线 0.2%-0.4%）`);
      actions.push("检查广告相关性，优化首图点击力");
      if (priority !== "P1") priority = "P2";
    }

    if (issues.length > 0) {
      suggestions.push({
        campaignName: name,
        ownerCode: rows[0]?.owner_code ?? "UNKNOWN",
        ownerName: rows[0]?.owner_name ?? "未识别",
        spend,
        adSales,
        orders,
        acos,
        ctr,
        cvr,
        issues,
        actions,
        priority,
        acosStatus: getAcosStatus(acos),
      });
    }
  }

  // P1 > P2 > P3，同级按花费降序
  suggestions.sort((a, b) => {
    const pOrder = { P1: 0, P2: 1, P3: 2 };
    const pd = pOrder[a.priority] - pOrder[b.priority];
    return pd !== 0 ? pd : b.spend - a.spend;
  });

  return suggestions;
}

// ============================================================
// Targeting 优化建议
// ============================================================
export interface TargetingSuggestion {
  campaignName: string;
  adGroupName: string;
  targeting: string;
  matchType: string;
  ownerCode: string;
  ownerName: string;
  spend: number;
  clicks: number;
  orders: number;
  acos: number | null;
  ctr: number | null;
  cvr: number | null;
  issues: string[];
  actions: string[];
  priority: "P1" | "P2" | "P3";
}

export function calcTargetingSuggestions(targetingRows: StandardRow[]): TargetingSuggestion[] {
  const suggestions: TargetingSuggestion[] = [];

  for (const row of targetingRows) {
    const spend = row.spend ?? 0;
    const clicks = row.clicks ?? 0;
    const orders = row.orders ?? 0;
    const impressions = row.impressions ?? 0;
    const acos = (row.ad_sales ?? 0) > 0 ? spend / (row.ad_sales ?? 1) : (row.acos ?? null);
    const ctr = impressions > 0 ? clicks / impressions : (row.ctr ?? null);
    const cvr = clicks > 0 ? orders / clicks : (row.ad_cvr ?? null);

    const issues: string[] = [];
    const actions: string[] = [];
    let priority: "P1" | "P2" | "P3" = "P3";

    // R006: ACOS红线
    if (acos !== null && acos > THRESHOLDS.acos.block) {
      issues.push(`ACOS阻断 ${pct(acos)}`);
      actions.push("立即暂停该投放词");
      priority = "P1";
    } else if (acos !== null && acos >= THRESHOLDS.acos.extreme) {
      issues.push(`ACOS极危 ${pct(acos)}`);
      actions.push("暂停或大幅降低出价");
      priority = "P1";
    } else if (acos !== null && acos >= THRESHOLDS.acos.danger) {
      issues.push(`ACOS高危 ${pct(acos)}`);
      actions.push("降低出价20%-30%，观察1-2周");
      priority = "P1";
    } else if (acos !== null && acos >= THRESHOLDS.acos.warning) {
      issues.push(`ACOS预警 ${pct(acos)}`);
      actions.push("降低出价10%-15%，控制预算");
            if ((priority as string) !== "P1") priority = "P2";
    }
    // R004: 精准词可扩量（ACOS优秀且有订单）
    if (
      row.match_type?.toUpperCase() === "EXACT" &&
      orders >= 2 &&
      acos !== null &&
      acos < THRESHOLDS.acos.excellent
    ) {
      issues.push(`精准词表现优秀（ACOS ${pct(acos)}，${orders}单）`);
      actions.push("提高出价/提升预算，争取顶部曝光");
      if ((priority as string) === "P3") priority = "P2";
    }

    // R007: CTR过低
    if (ctr !== null && ctr < THRESHOLDS.ctr.critical) {
      issues.push(`CTR极低 ${pct(ctr)}`);
      actions.push("检查词相关性，考虑否定或降低出价");
      priority = "P1";
    }

    if (issues.length > 0) {
      suggestions.push({
        campaignName: row.campaign_name ?? "",
        adGroupName: row.ad_group_name ?? "",
        targeting: row.targeting ?? "",
        matchType: row.match_type ?? "",
        ownerCode: row.owner_code ?? "UNKNOWN",
        ownerName: row.owner_name ?? "未识别",
        spend,
        clicks,
        orders,
        acos,
        ctr,
        cvr,
        issues,
        actions,
        priority,
      });
    }
  }

  suggestions.sort((a, b) => {
    const pOrder = { P1: 0, P2: 1, P3: 2 };
    const pd = pOrder[a.priority] - pOrder[b.priority];
    return pd !== 0 ? pd : b.spend - a.spend;
  });

  return suggestions.slice(0, 500); // 最多返回500条
}

// ============================================================
// Search Term 核心分析（以搜索词为主）
// ============================================================

/** 词性分类 */
export type WordCategory =
  | "brand"        // 品牌词
  | "competitor"   // 竞品词
  | "functional"   // 功能词
  | "longtail"     // 长尾词
  | "generic";     // 泛求词

/** 词级别聚合指标 */
export interface SearchTermAggregate {
  searchTerm: string;
  wordCategory: WordCategory;
  totalImpressions: number;
  totalClicks: number;
  totalSpend: number;
  totalOrders: number;
  totalSales: number;
  acos: number | null;
  cvr: number | null;
  ctr: number | null;
  cpc: number | null;
  campaignCount: number;       // 出现在多少个 Campaign
  campaigns: string[];         // 关联的 Campaign 列表
  matchTypes: string[];        // 匹配类型列表
  ownerNames: string[];        // 负责人列表
  label: "high_value" | "loss" | "invalid" | "potential" | "normal";
  labelReason: string;
}

/** 词根聚合指标 */
export interface WordRootAggregate {
  root: string;                 // 词根（首词或核心词）
  termCount: number;            // 包含该词根的搜索词数
  totalImpressions: number;
  totalClicks: number;
  totalSpend: number;
  totalOrders: number;
  totalSales: number;
  acos: number | null;
  cvr: number | null;
  ctr: number | null;
  topTerms: string[];           // 花费最高的子词（最多5个）
  label: "high_value" | "loss" | "invalid" | "potential" | "normal";
}

/** 匹配类型维度分析 */
export interface MatchTypeAnalysis {
  matchType: string;
  termCount: number;
  totalImpressions: number;
  totalClicks: number;
  totalSpend: number;
  totalOrders: number;
  totalSales: number;
  acos: number | null;
  cvr: number | null;
  ctr: number | null;
  cpc: number | null;
  spendShare: number;           // 占总花费比例
}

/** 二维散点图数据点 */
export interface ScatterPoint {
  searchTerm: string;
  spend: number;
  cvr: number;
  orders: number;
  acos: number | null;
  label: string;
  wordCategory: WordCategory;
}

/** 搜索词深度分析结果 */
export interface SearchTermAnalysis {
  totalTerms: number;          // 搜索词总数
  uniqueTerms: number;         // 去重后的单一词数
  totalSpend: number;
  totalOrders: number;
  totalSales: number;
  avgAcos: number | null;
  avgCvr: number | null;
  // 分类汇总
  highValueTerms: SearchTermAggregate[];   // 高价值词（转化好、ACOS优）
  lossTerms: SearchTermAggregate[];        // 亏损词（花费多、ACOS高）
  invalidTerms: SearchTermAggregate[];     // 无效词（点击多、无转化）
  potentialTerms: SearchTermAggregate[];   // 潜力词（曝光多、点击少）
  // 词性分布
  categoryDistribution: Record<WordCategory, { count: number; spend: number; orders: number }>;
  // Top词汇总表（按花费降序）
  topTermsBySpend: SearchTermAggregate[];
  // 负责人维度搜索词汇总
  ownerTermStats: Array<{
    ownerName: string;
    ownerCode: string;
    termCount: number;
    spend: number;
    orders: number;
    acos: number | null;
    highValueCount: number;
    invalidCount: number;
  }>;
  // 新增：词根分析
  wordRootAnalysis: WordRootAggregate[];
  // 新增：匹配类型维度分析
  matchTypeAnalysis: MatchTypeAnalysis[];
  // 新增：二维散点图数据（花费 vs CVR）
  scatterData: ScatterPoint[];
}

/**
 * 判断词性分类
 */
function classifyWord(term: string): WordCategory {
  const t = term.toLowerCase();
  // 长尾词：词数大于3个
  const wordCount = t.split(/\s+/).filter(Boolean).length;
  if (wordCount >= 4) return "longtail";
  // 竞品词：包含常见竞品品牌名（可根据实际业务扩展）
  const competitorKeywords = ["competitor", "rival", "vs", "alternative", "compare"];
  if (competitorKeywords.some(k => t.includes(k))) return "competitor";
  // 功能词：包含功能/用途类关键词
  const functionalKeywords = ["for", "with", "without", "anti", "pro", "plus", "max", "mini", "heavy", "light", "fast", "slow", "large", "small", "big", "long", "short", "waterproof", "wireless", "rechargeable", "portable", "adjustable", "foldable"];
  if (functionalKeywords.some(k => t.includes(k))) return "functional";
  // 泛求词：单词
  if (wordCount === 1) return "generic";
  return "functional";
}

/**
 * 搜索词深度分析主函数
 */
export function calcSearchTermAnalysis(searchTermRows: StandardRow[]): SearchTermAnalysis {
  // 按搜索词聚合
  const termMap = new Map<string, {
    rows: StandardRow[];
    campaigns: Set<string>;
    matchTypes: Set<string>;
    owners: Map<string, string>; // code -> name
  }>();

  for (const row of searchTermRows) {
    const term = (row.search_term ?? "").trim().toLowerCase();
    if (!term) continue;
    if (!termMap.has(term)) {
      termMap.set(term, { rows: [], campaigns: new Set(), matchTypes: new Set(), owners: new Map() });
    }
    const entry = termMap.get(term)!;
    entry.rows.push(row);
    if (row.campaign_name) entry.campaigns.add(row.campaign_name);
    if (row.match_type) entry.matchTypes.add(row.match_type.toUpperCase());
    if (row.owner_code && row.owner_name) entry.owners.set(row.owner_code, row.owner_name);
  }

  const aggregates: SearchTermAggregate[] = [];

  for (const [term, entry] of Array.from(termMap.entries())) {
    const rows = entry.rows;
    const totalImpressions = sum(rows, "impressions");
    const totalClicks = sum(rows, "clicks");
    const totalSpend = sum(rows, "spend");
    const totalOrders = sum(rows, "orders");
    const totalSales = sum(rows, "ad_sales");

    const acos = totalSales > 0 ? totalSpend / totalSales : null;
    const cvr = totalClicks > 0 ? totalOrders / totalClicks : null;
    const ctr = totalImpressions > 0 ? totalClicks / totalImpressions : null;
    const cpc = totalClicks > 0 ? totalSpend / totalClicks : null;

    const wordCategory = classifyWord(term);

    // 标签判断
    let label: SearchTermAggregate["label"] = "normal";
    let labelReason = "";

    if (totalClicks >= THRESHOLDS.clicks_no_order && totalOrders === 0) {
      label = "invalid";
      labelReason = `点击${totalClicks}次无转化，建议否词`;
    } else if (totalOrders >= 3 && acos !== null && acos < THRESHOLDS.acos.excellent) {
      label = "high_value";
      labelReason = `${totalOrders}单，ACOS ${pct(acos)}，高价值词`;
    } else if (totalSpend > 5 && acos !== null && acos > THRESHOLDS.acos.danger) {
      label = "loss";
      labelReason = `花费$${totalSpend.toFixed(2)}，ACOS ${pct(acos)}，亏损词`;
    } else if (totalImpressions >= 500 && totalClicks < 5) {
      label = "potential";
      labelReason = `曝光${totalImpressions}次但点击仅${totalClicks}次，可优化主图/标题`;
    }

    aggregates.push({
      searchTerm: term,
      wordCategory,
      totalImpressions,
      totalClicks,
      totalSpend,
      totalOrders,
      totalSales,
      acos,
      cvr,
      ctr,
      cpc,
      campaignCount: entry.campaigns.size,
      campaigns: Array.from(entry.campaigns).slice(0, 5),
      matchTypes: Array.from(entry.matchTypes),
      ownerNames: Array.from(entry.owners.values()),
      label,
      labelReason,
    });
  }

  // 分类
  const highValueTerms = aggregates.filter(a => a.label === "high_value").sort((a, b) => b.totalOrders - a.totalOrders).slice(0, 100);
  const lossTerms = aggregates.filter(a => a.label === "loss").sort((a, b) => b.totalSpend - a.totalSpend).slice(0, 100);
  const invalidTerms = aggregates.filter(a => a.label === "invalid").sort((a, b) => b.totalSpend - a.totalSpend).slice(0, 200);
  const potentialTerms = aggregates.filter(a => a.label === "potential").sort((a, b) => b.totalImpressions - a.totalImpressions).slice(0, 100);
  const topTermsBySpend = [...aggregates].sort((a, b) => b.totalSpend - a.totalSpend).slice(0, 100);

  // 词性分布
  const categoryDistribution: Record<WordCategory, { count: number; spend: number; orders: number }> = {
    brand: { count: 0, spend: 0, orders: 0 },
    competitor: { count: 0, spend: 0, orders: 0 },
    functional: { count: 0, spend: 0, orders: 0 },
    longtail: { count: 0, spend: 0, orders: 0 },
    generic: { count: 0, spend: 0, orders: 0 },
  };
  for (const a of aggregates) {
    categoryDistribution[a.wordCategory].count++;
    categoryDistribution[a.wordCategory].spend += a.totalSpend;
    categoryDistribution[a.wordCategory].orders += a.totalOrders;
  }

  // 负责人维度搜索词汇总
  const ownerTermMap = new Map<string, {
    ownerCode: string; ownerName: string;
    terms: Set<string>; spend: number; orders: number;
    highValueCount: number; invalidCount: number;
  }>();
  for (const row of searchTermRows) {
    const code = row.owner_code ?? "UNKNOWN";
    const name = row.owner_name ?? "未识别";
    const term = (row.search_term ?? "").trim().toLowerCase();
    if (!ownerTermMap.has(code)) {
      ownerTermMap.set(code, { ownerCode: code, ownerName: name, terms: new Set(), spend: 0, orders: 0, highValueCount: 0, invalidCount: 0 });
    }
    const entry = ownerTermMap.get(code)!;
    entry.terms.add(term);
    entry.spend += row.spend ?? 0;
    entry.orders += row.orders ?? 0;
  }
  // 将高价值词/无效词计入负责人
  for (const a of aggregates) {
    for (const ownerName of a.ownerNames) {
      for (const [code, entry] of Array.from(ownerTermMap.entries())) {
        if (entry.ownerName === ownerName) {
          if (a.label === "high_value") entry.highValueCount++;
          if (a.label === "invalid") entry.invalidCount++;
        }
      }
    }
  }
  const ownerTermStats = Array.from(ownerTermMap.values()).map(e => ({
    ownerName: e.ownerName,
    ownerCode: e.ownerCode,
    termCount: e.terms.size,
    spend: e.spend,
    orders: e.orders,
    acos: e.orders > 0 ? e.spend / (e.orders * 30) : null, // 简化计算
    highValueCount: e.highValueCount,
    invalidCount: e.invalidCount,
  })).sort((a, b) => b.spend - a.spend);

  const totalSpend = aggregates.reduce((s, a) => s + a.totalSpend, 0);
  const totalOrders = aggregates.reduce((s, a) => s + a.totalOrders, 0);
  const totalSales = aggregates.reduce((s, a) => s + a.totalSales, 0);
  const avgAcos = totalSales > 0 ? totalSpend / totalSales : null;
  const totalClicks = aggregates.reduce((s, a) => s + a.totalClicks, 0);
  const avgCvr = totalClicks > 0 ? totalOrders / totalClicks : null;

  // ============================================================
  // 词根分析：提取每个搜索词的首词作为词根，按词根聚合
  // ============================================================
  const rootMap = new Map<string, {
    terms: Map<string, number>; // term -> spend
    impressions: number; clicks: number; spend: number; orders: number; sales: number;
  }>();

  for (const agg of aggregates) {
    const words = agg.searchTerm.split(/\s+/).filter(Boolean);
    if (words.length === 0) continue;
    // 词根策略：单词直接用该词；多词取前两词组合作为词根
    const root = words.length === 1 ? words[0] : words.slice(0, 2).join(" ");
    if (!rootMap.has(root)) {
      rootMap.set(root, { terms: new Map(), impressions: 0, clicks: 0, spend: 0, orders: 0, sales: 0 });
    }
    const re = rootMap.get(root)!;
    re.terms.set(agg.searchTerm, agg.totalSpend);
    re.impressions += agg.totalImpressions;
    re.clicks += agg.totalClicks;
    re.spend += agg.totalSpend;
    re.orders += agg.totalOrders;
    re.sales += agg.totalSales;
  }

  const wordRootAnalysis: WordRootAggregate[] = Array.from(rootMap.entries())
    .filter(([, v]) => v.terms.size >= 2) // 至少包含2个搜索词的词根才展示
    .map(([root, v]) => {
      const acos = v.sales > 0 ? v.spend / v.sales : null;
      const cvr = v.clicks > 0 ? v.orders / v.clicks : null;
      const ctr = v.impressions > 0 ? v.clicks / v.impressions : null;
      const topTerms = Array.from(v.terms.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([t]) => t);
      // 词根标签判断
      let label: WordRootAggregate["label"] = "normal";
      if (v.orders >= 5 && acos !== null && acos < THRESHOLDS.acos.excellent) label = "high_value";
      else if (v.spend > 20 && acos !== null && acos > THRESHOLDS.acos.danger) label = "loss";
      else if (v.clicks >= 50 && v.orders === 0) label = "invalid";
      else if (v.impressions >= 2000 && v.clicks < 20) label = "potential";
      return { root, termCount: v.terms.size, totalImpressions: v.impressions, totalClicks: v.clicks, totalSpend: v.spend, totalOrders: v.orders, totalSales: v.sales, acos, cvr, ctr, topTerms, label };
    })
    .sort((a, b) => b.totalSpend - a.totalSpend)
    .slice(0, 200);

  // ============================================================
  // 匹配类型维度分析
  // ============================================================
  const matchTypeMap = new Map<string, {
    terms: Set<string>; impressions: number; clicks: number; spend: number; orders: number; sales: number;
  }>();

  for (const row of searchTermRows) {
    const mt = (row.match_type ?? "UNKNOWN").toUpperCase();
    const term = (row.search_term ?? "").trim().toLowerCase();
    if (!matchTypeMap.has(mt)) {
      matchTypeMap.set(mt, { terms: new Set(), impressions: 0, clicks: 0, spend: 0, orders: 0, sales: 0 });
    }
    const me = matchTypeMap.get(mt)!;
    if (term) me.terms.add(term);
    me.impressions += row.impressions ?? 0;
    me.clicks += row.clicks ?? 0;
    me.spend += row.spend ?? 0;
    me.orders += row.orders ?? 0;
    me.sales += row.ad_sales ?? 0;
  }

  const matchTypeTotalSpend = Array.from(matchTypeMap.values()).reduce((s, v) => s + v.spend, 0);
  const matchTypeAnalysis: MatchTypeAnalysis[] = Array.from(matchTypeMap.entries())
    .map(([matchType, v]) => ({
      matchType,
      termCount: v.terms.size,
      totalImpressions: v.impressions,
      totalClicks: v.clicks,
      totalSpend: v.spend,
      totalOrders: v.orders,
      totalSales: v.sales,
      acos: v.sales > 0 ? v.spend / v.sales : null,
      cvr: v.clicks > 0 ? v.orders / v.clicks : null,
      ctr: v.impressions > 0 ? v.clicks / v.impressions : null,
      cpc: v.clicks > 0 ? v.spend / v.clicks : null,
      spendShare: matchTypeTotalSpend > 0 ? v.spend / matchTypeTotalSpend : 0,
    }))
    .sort((a, b) => b.totalSpend - a.totalSpend);

  // ============================================================
  // 二维散点图数据：花费 vs CVR（只取有点击的词）
  // ============================================================
  const scatterData: ScatterPoint[] = aggregates
    .filter(a => a.totalClicks >= 3 && a.cvr !== null)
    .map(a => ({
      searchTerm: a.searchTerm,
      spend: a.totalSpend,
      cvr: a.cvr!,
      orders: a.totalOrders,
      acos: a.acos,
      label: a.label,
      wordCategory: a.wordCategory,
    }))
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 500); // 最多500个点避免前端卡顿

  return {
    totalTerms: searchTermRows.length,
    uniqueTerms: termMap.size,
    totalSpend,
    totalOrders,
    totalSales,
    avgAcos,
    avgCvr,
    highValueTerms,
    lossTerms,
    invalidTerms,
    potentialTerms,
    categoryDistribution,
    topTermsBySpend,
    ownerTermStats,
    wordRootAnalysis,
    matchTypeAnalysis,
    scatterData,
  };
}

// ============================================================
// Search Term 三类清单
// ============================================================
export interface SearchTermItem {
  campaignName: string;
  adGroupName: string;
  targeting: string;
  matchType: string;
  searchTerm: string;
  ownerCode: string;
  ownerName: string;
  clicks: number;
  spend: number;
  orders: number;
  acos: number | null;
  reason: string;
  action: string;
  negateType?: string; // 否词类型
}

export interface SearchTermLists {
  negateList: SearchTermItem[];      // 否词建议
  toExactList: SearchTermItem[];     // 转精准建议
  amplifyList: SearchTermItem[];     // 放大投放建议
}

export function calcSearchTermLists(searchTermRows: StandardRow[]): SearchTermLists {
  const negateList: SearchTermItem[] = [];
  const toExactList: SearchTermItem[] = [];
  const amplifyList: SearchTermItem[] = [];

  for (const row of searchTermRows) {
    const clicks = row.clicks ?? 0;
    const orders = row.orders ?? 0;
    const spend = row.spend ?? 0;
    const adSales = row.ad_sales ?? 0;
    const acos = adSales > 0 ? spend / adSales : null;
    const matchType = row.match_type?.toUpperCase() ?? "";

    const base: Omit<SearchTermItem, "reason" | "action" | "negateType"> = {
      campaignName: row.campaign_name ?? "",
      adGroupName: row.ad_group_name ?? "",
      targeting: row.targeting ?? "",
      matchType: row.match_type ?? "",
      searchTerm: row.search_term ?? "",
      ownerCode: row.owner_code ?? "UNKNOWN",
      ownerName: row.owner_name ?? "未识别",
      clicks,
      spend,
      orders,
      acos,
    };

    // R002（固定规则）：Clicks > 20 且 Orders = 0 → 否词
    if (clicks > THRESHOLDS.clicks_no_order && orders === 0) {
      // 判断是否相关：如果search_term包含targeting词则认为相关
      const isRelated =
        row.search_term &&
        row.targeting &&
        row.search_term.toLowerCase().includes(row.targeting.toLowerCase().split(" ")[0]);
      negateList.push({
        ...base,
        reason: `点击${clicks}次，0单（超过20点击无出单固定规则）`,
        action: isRelated
          ? "否定精准（相关但不转化）"
          : "否定短语/词组（明显不相关）",
        negateType: isRelated ? "否定精准" : "否定短语",
      });
      continue;
    }

    // R003：Broad/Phrase/Auto中高转化词 → 转精准
    if (
      (matchType === "BROAD" || matchType === "PHRASE" || matchType === "AUTO") &&
      orders >= 2 &&
      acos !== null &&
      acos < THRESHOLDS.acos.excellent
    ) {
      toExactList.push({
        ...base,
        reason: `${orders}单，ACOS ${pct(acos)}，在${matchType}中表现优秀`,
        action: "转Exact单独投放，原词保留观察",
      });
    }

    // R004：精准词高转化 → 放大
    if (
      matchType === "EXACT" &&
      orders >= 3 &&
      acos !== null &&
      acos < THRESHOLDS.acos.excellent
    ) {
      amplifyList.push({
        ...base,
        reason: `精准词${orders}单，ACOS ${pct(acos)}，可扩量`,
        action: "提高出价/提升预算，争取顶部曝光位置",
      });
    }
  }

  // 按花费降序
  negateList.sort((a, b) => b.spend - a.spend);
  toExactList.sort((a, b) => b.orders - a.orders);
  amplifyList.sort((a, b) => b.orders - a.orders);

  return {
    negateList: negateList.slice(0, 200),
    toExactList: toExactList.slice(0, 200),
    amplifyList: amplifyList.slice(0, 200),
  };
}

// ============================================================
// 运营动作清单
// ============================================================
export interface ActionItem {
  id: string;
  priority: "P1" | "P2" | "P3";
  category: string;
  ownerCode: string;
  ownerName: string;
  target: string;
  issue: string;
  action: string;
  metrics: string;
}

export function buildActionItems(
  campaignSuggestions: CampaignSuggestion[],
  targetingSuggestions: TargetingSuggestion[],
  searchTermLists: SearchTermLists
): ActionItem[] {
  const items: ActionItem[] = [];
  let idx = 1;

  // Campaign级别动作
  for (const s of campaignSuggestions) {
    for (let i = 0; i < s.issues.length; i++) {
      items.push({
        id: `ACT-${String(idx++).padStart(3, "0")}`,
        priority: s.priority,
        category: "Campaign优化",
        ownerCode: s.ownerCode,
        ownerName: s.ownerName,
        target: s.campaignName,
        issue: s.issues[i],
        action: s.actions[i] ?? s.actions[0],
        metrics: `花费$${s.spend.toFixed(2)} | 销售$${s.adSales.toFixed(2)} | ACOS${s.acos !== null ? pct(s.acos) : "N/A"} | ${s.orders}单`,
      });
    }
  }

  // Targeting级别动作（P1）
  for (const t of targetingSuggestions.filter((t) => t.priority === "P1").slice(0, 50)) {
    items.push({
      id: `ACT-${String(idx++).padStart(3, "0")}`,
      priority: t.priority,
      category: "Targeting优化",
      ownerCode: t.ownerCode,
      ownerName: t.ownerName,
      target: `${t.targeting} [${t.matchType}]`,
      issue: t.issues[0],
      action: t.actions[0],
      metrics: `花费$${t.spend.toFixed(2)} | ${t.clicks}次点击 | ${t.orders}单`,
    });
  }

  // 否词动作（P1）
  for (const n of searchTermLists.negateList.slice(0, 50)) {
    items.push({
      id: `ACT-${String(idx++).padStart(3, "0")}`,
      priority: "P1",
      category: "Search Term否词",
      ownerCode: n.ownerCode,
      ownerName: n.ownerName,
      target: n.searchTerm,
      issue: n.reason,
      action: n.action,
      metrics: `花费$${n.spend.toFixed(2)} | ${n.clicks}次点击 | 0单`,
    });
  }

  // 转精准动作
  for (const t of searchTermLists.toExactList.slice(0, 30)) {
    items.push({
      id: `ACT-${String(idx++).padStart(3, "0")}`,
      priority: "P2",
      category: "Search Term转精准",
      ownerCode: t.ownerCode,
      ownerName: t.ownerName,
      target: t.searchTerm,
      issue: t.reason,
      action: t.action,
      metrics: `花费$${t.spend.toFixed(2)} | ${t.orders}单 | ACOS${t.acos !== null ? pct(t.acos) : "N/A"}`,
    });
  }

  // 放大动作
  for (const a of searchTermLists.amplifyList.slice(0, 30)) {
    items.push({
      id: `ACT-${String(idx++).padStart(3, "0")}`,
      priority: "P2",
      category: "Search Term放大",
      ownerCode: a.ownerCode,
      ownerName: a.ownerName,
      target: a.searchTerm,
      issue: a.reason,
      action: a.action,
      metrics: `花费$${a.spend.toFixed(2)} | ${a.orders}单 | ACOS${a.acos !== null ? pct(a.acos) : "N/A"}`,
    });
  }

  // P1 > P2 > P3
  items.sort((a, b) => {
    const pOrder = { P1: 0, P2: 1, P3: 2 };
    return pOrder[a.priority] - pOrder[b.priority];
  });

  return items;
}

// ============================================================
// 完整分析流程
// ============================================================
export interface FullAnalysisResult {
  accountOverview: AccountOverview;
  ownerAnalysis: OwnerMetrics[];
  campaignSuggestions: CampaignSuggestion[];
  targetingSuggestions: TargetingSuggestion[];
  searchTermLists: SearchTermLists;
  searchTermAnalysis: SearchTermAnalysis;  // 新增：搜索词深度分析
  actionItems: ActionItem[];
}

export function runFullAnalysis(allRows: {
  campaignRows: StandardRow[];
  targetingRows: StandardRow[];
  searchTermRows: StandardRow[];
  advertisedProductRows: StandardRow[];
  brRows: StandardRow[];
}): FullAnalysisResult {
  const { campaignRows, targetingRows, searchTermRows, brRows } = allRows;

  const accountOverview = calcAccountOverview(campaignRows, brRows);
  const ownerAnalysis = calcOwnerAnalysis(campaignRows);
  const campaignSuggestions = calcCampaignSuggestions(campaignRows);
  const targetingSuggestions = calcTargetingSuggestions(targetingRows);
  const searchTermLists = calcSearchTermLists(searchTermRows);
  const searchTermAnalysis = calcSearchTermAnalysis(searchTermRows); // 新增
  const actionItems = buildActionItems(campaignSuggestions, targetingSuggestions, searchTermLists);

  return {
    accountOverview,
    ownerAnalysis,
    campaignSuggestions,
    targetingSuggestions,
    searchTermLists,
    searchTermAnalysis,
    actionItems,
  };
}

// ============================================================
// 工具函数
// ============================================================
function sum(rows: StandardRow[], field: keyof StandardRow): number {
  return rows.reduce((s, r) => s + (Number(r[field]) || 0), 0);
}

function pct(val: number | null): string {
  if (val === null) return "N/A";
  return (val * 100).toFixed(1) + "%";
}

function getAcosStatus(acos: number | null): string {
  if (acos === null) return "无数据";
  if (acos > THRESHOLDS.acos.block) return "阻断";
  if (acos >= THRESHOLDS.acos.extreme) return "极危";
  if (acos >= THRESHOLDS.acos.danger) return "高危";
  if (acos >= THRESHOLDS.acos.warning) return "预警";
  if (acos >= THRESHOLDS.acos.normal) return "正常";
  return "优秀";
}

function getCvrStatus(cvr: number | null): string {
  if (cvr === null) return "无数据";
  if (cvr >= THRESHOLDS.cvr.excellent) return "优秀";
  if (cvr >= THRESHOLDS.cvr.good) return "中等";
  if (cvr >= THRESHOLDS.cvr.pass) return "及格";
  if (cvr >= THRESHOLDS.cvr.warning) return "预警";
  if (cvr >= THRESHOLDS.cvr.critical) return "严重";
  return "特别严重";
}

function getCtrStatus(ctr: number | null): string {
  if (ctr === null) return "无数据";
  if (ctr >= THRESHOLDS.ctr.excellent) return "优秀";
  if (ctr >= THRESHOLDS.ctr.good) return "中等";
  if (ctr >= THRESHOLDS.ctr.pass) return "及格";
  if (ctr >= THRESHOLDS.ctr.warning) return "注意";
  return "问题";
}
