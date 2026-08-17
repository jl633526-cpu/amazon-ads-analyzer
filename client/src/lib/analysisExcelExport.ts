import * as XLSX from "xlsx";

type DataRow = Record<string, unknown>;

export interface AnalysisExportResult {
  accountOverview?: DataRow;
  ownerAnalysis?: DataRow[];
  campaignSuggestions?: DataRow[];
  targetingSuggestions?: DataRow[];
  searchTermLists?: {
    negateList?: DataRow[];
    toExactList?: DataRow[];
    amplifyList?: DataRow[];
    negate_list?: DataRow[];
    to_exact_list?: DataRow[];
    amplify_list?: DataRow[];
  };
  searchTermAnalysis?: {
    highValueTerms?: DataRow[];
    lossTerms?: DataRow[];
    invalidTerms?: DataRow[];
    potentialTerms?: DataRow[];
    topTermsBySpend?: DataRow[];
    wordRootAnalysis?: DataRow[];
    matchTypeAnalysis?: DataRow[];
  };
  actionItems?: DataRow[];
}

export interface AnalysisExcelExportOptions {
  result: AnalysisExportResult;
  taskName: string;
  ownerCode?: string;
  ownerName?: string;
}

const currencyHeaders = new Set([
  "花费", "广告销售额", "总销售额", "自然销售额", "无订单花费", "CPC", "销售额", "总花费",
]);
const percentHeaders = new Set([
  "ACOS", "TACOS", "CTR", "CVR", "浪费率", "广告销售占比", "自然销售占比", "花费占比",
]);
const integerHeaders = new Set([
  "展示量", "点击量", "订单", "Campaign数", "词数", "搜索词数", "排名", "关联Campaign数",
]);

function numeric(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function arrayValue(value: unknown): string {
  return Array.isArray(value) ? value.join("；") : String(value ?? "");
}

function filterByOwner(rows: DataRow[] | undefined, ownerCode?: string, ownerName?: string): DataRow[] {
  const values = rows ?? [];
  if (!ownerCode || ownerCode === "ALL") return values;
  return values.filter((row) => row.ownerCode === ownerCode || row.ownerName === ownerName ||
    (Array.isArray(row.ownerNames) && row.ownerNames.includes(ownerName)));
}

function messageSheetRow(message: string): DataRow[] {
  return [{ "提示": message }];
}

function applySheetFormat(sheet: XLSX.WorkSheet, rows: DataRow[]) {
  const headers = Object.keys(rows[0] ?? {});
  sheet["!autofilter"] = headers.length ? { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(rows.length, 1), c: headers.length - 1 } }) } : undefined;
  sheet["!cols"] = headers.map((header) => ({ wch: Math.min(Math.max(header.length + 4, 12), 36) }));
  sheet["!freeze"] = { xSplit: 0, ySplit: 1 };

  headers.forEach((header, colIndex) => {
    for (let rowIndex = 1; rowIndex <= rows.length; rowIndex += 1) {
      const cell = sheet[XLSX.utils.encode_cell({ r: rowIndex, c: colIndex })];
      if (!cell || typeof cell.v !== "number") continue;
      if (currencyHeaders.has(header)) cell.z = "$#,##0.00";
      else if (percentHeaders.has(header)) cell.z = "0.00%";
      else if (integerHeaders.has(header)) cell.z = "#,##0";
      else if (header === "ROAS") cell.z = "0.00x";
    }
  });
}

function appendSheet(workbook: XLSX.WorkBook, name: string, rows: DataRow[]) {
  const normalizedRows = rows.length ? rows : messageSheetRow("当前筛选条件下暂无数据");
  const sheet = XLSX.utils.json_to_sheet(normalizedRows);
  applySheetFormat(sheet, normalizedRows);
  XLSX.utils.book_append_sheet(workbook, sheet, name);
}

function makeOverviewRows(overview?: DataRow): DataRow[] {
  if (!overview) return [];
  const mapping: Array<[string, string, "currency" | "percent" | "integer" | "text"]> = [
    ["总花费", "totalSpend", "currency"], ["广告销售额", "totalAdSales", "currency"],
    ["总销售额", "totalSales", "currency"], ["自然销售额", "totalNaturalSales", "currency"],
    ["总订单", "totalOrders", "integer"], ["总点击", "totalClicks", "integer"],
    ["总曝光", "totalImpressions", "integer"], ["总会话", "totalSessions", "integer"],
    ["ACOS", "acos", "percent"], ["ROAS", "roas", "text"], ["TACOS", "tacos", "percent"],
    ["CTR", "ctr", "percent"], ["CVR", "cvr", "percent"], ["CPC", "cpc", "currency"],
    ["广告销售占比", "adSalesShare", "percent"], ["自然销售占比", "naturalSalesShare", "percent"],
    ["Campaign数", "campaignCount", "integer"], ["活跃Campaign数", "activeCampaignCount", "integer"],
    ["负责人数量", "ownerCount", "integer"], ["ACOS状态", "acosStatus", "text"],
    ["CVR状态", "cvrStatus", "text"], ["CTR状态", "ctrStatus", "text"],
  ];
  return mapping.map(([metric, key, kind]) => ({
    "指标": metric,
    "数值": overview[key] ?? "",
    "格式": kind,
  }));
}

function makeOwnerOverviewRows(owner?: DataRow, ownerName?: string): DataRow[] {
  if (!owner) return [];
  const mapping: Array<[string, string, "currency" | "percent" | "integer" | "text"]> = [
    ["广告总花费", "spend", "currency"], ["广告销售额", "adSales", "currency"],
    ["广告订单", "orders", "integer"], ["总点击", "clicks", "integer"],
    ["总曝光", "impressions", "integer"], ["ACOS", "acos", "percent"],
    ["ROAS", "roas", "text"], ["CTR", "ctr", "percent"], ["CVR", "cvr", "percent"],
    ["CPC", "cpc", "currency"], ["无订单花费", "wasteSpend", "currency"],
    ["浪费率", "wasteRate", "percent"], ["Campaign数", "campaignCount", "integer"],
    ["ACOS状态", "acosStatus", "text"], ["CVR状态", "cvrStatus", "text"],
  ];
  return [
    { "指标": "导出范围", "数值": ownerName ?? owner.ownerName ?? "", "格式": "text" },
    ...mapping.map(([metric, key, kind]) => ({ "指标": metric, "数值": owner[key] ?? "", "格式": kind })),
  ];
}

function makeOwnerRows(rows: DataRow[]) {
  return rows.map((row) => ({
    "排名": row.rank ?? "", "负责人": row.ownerName ?? "", "负责人编码": row.ownerCode ?? "",
    "花费": numeric(row.spend), "广告销售额": numeric(row.adSales), "订单": numeric(row.orders),
    "点击量": numeric(row.clicks), "展示量": numeric(row.impressions), "ACOS": numeric(row.acos),
    "ROAS": numeric(row.roas), "CTR": numeric(row.ctr), "CVR": numeric(row.cvr), "CPC": numeric(row.cpc),
    "无订单花费": numeric(row.wasteSpend), "浪费率": numeric(row.wasteRate), "Campaign数": numeric(row.campaignCount),
    "ACOS状态": row.acosStatus ?? "", "CVR状态": row.cvrStatus ?? "",
  }));
}

function makeCampaignRows(rows: DataRow[]) {
  return rows.map((row) => ({
    "优先级": row.priority ?? "", "Campaign": row.campaignName ?? "", "负责人": row.ownerName ?? "",
    "负责人编码": row.ownerCode ?? "", "花费": numeric(row.spend), "广告销售额": numeric(row.adSales),
    "订单": numeric(row.orders), "点击量": numeric(row.clicks), "ACOS": numeric(row.acos),
    "CTR": numeric(row.ctr), "CVR": numeric(row.cvr), "CPC": numeric(row.cpc),
    "问题": arrayValue(row.issues), "建议动作": arrayValue(row.actions), "ACOS状态": row.acosStatus ?? "",
  }));
}

function makeTargetingRows(rows: DataRow[]) {
  return rows.map((row) => ({
    "优先级": row.priority ?? "", "关键词/ASIN": row.targeting ?? "", "匹配类型": row.matchType ?? "",
    "Campaign": row.campaignName ?? "", "广告组": row.adGroupName ?? "", "负责人": row.ownerName ?? "",
    "负责人编码": row.ownerCode ?? "", "花费": numeric(row.spend), "点击量": numeric(row.clicks),
    "订单": numeric(row.orders), "ACOS": numeric(row.acos), "CTR": numeric(row.ctr), "CVR": numeric(row.cvr),
    "CPC": numeric(row.cpc), "问题": arrayValue(row.issues), "建议动作": arrayValue(row.actions),
  }));
}

function makeSearchAggregateRows(rows: DataRow[]) {
  return rows.map((row) => ({
    "搜索词": row.searchTerm ?? "", "词性": row.wordCategory ?? "", "标签": row.label ?? "",
    "标签说明": row.labelReason ?? "", "展示量": numeric(row.totalImpressions), "点击量": numeric(row.totalClicks),
    "花费": numeric(row.totalSpend), "广告销售额": numeric(row.totalSales), "订单": numeric(row.totalOrders),
    "ACOS": numeric(row.acos), "CTR": numeric(row.ctr), "CVR": numeric(row.cvr), "CPC": numeric(row.cpc),
    "关联Campaign数": numeric(row.campaignCount), "Campaign": arrayValue(row.campaigns),
    "匹配类型": arrayValue(row.matchTypes), "负责人": arrayValue(row.ownerNames),
  }));
}

function makeSearchActionRows(rows: DataRow[]) {
  return rows.map((row) => ({
    "搜索词": row.searchTerm ?? "", "关键词/投放": row.targeting ?? "", "匹配类型": row.matchType ?? "",
    "Campaign": row.campaignName ?? "", "广告组": row.adGroupName ?? "", "负责人": row.ownerName ?? "",
    "负责人编码": row.ownerCode ?? "", "点击量": numeric(row.clicks), "花费": numeric(row.spend),
    "订单": numeric(row.orders), "ACOS": numeric(row.acos), "原因": row.reason ?? "",
    "建议动作": row.action ?? "", "否词类型": row.negateType ?? "",
  }));
}

function makeActionRows(rows: DataRow[]) {
  return rows.map((row) => ({
    "ID": row.id ?? "", "优先级": row.priority ?? "", "类别": row.category ?? "", "负责人": row.ownerName ?? "",
    "负责人编码": row.ownerCode ?? "", "目标": row.target ?? "", "问题": row.issue ?? "",
    "建议动作": row.action ?? "", "指标": row.metrics ?? "",
  }));
}

function makeRootRows(rows: DataRow[]) {
  return rows.map((row) => ({
    "词根": row.root ?? "", "词数": numeric(row.termCount), "展示量": numeric(row.totalImpressions),
    "点击量": numeric(row.totalClicks), "花费": numeric(row.totalSpend), "广告销售额": numeric(row.totalSales),
    "订单": numeric(row.totalOrders), "ACOS": numeric(row.acos), "CTR": numeric(row.ctr),
    "CVR": numeric(row.cvr), "标签": row.label ?? "", "主要变体词": arrayValue(row.topTerms),
  }));
}

function makeMatchTypeRows(rows: DataRow[]) {
  return rows.map((row) => ({
    "匹配类型": row.matchType ?? "", "搜索词数": numeric(row.termCount), "展示量": numeric(row.totalImpressions),
    "点击量": numeric(row.totalClicks), "花费": numeric(row.totalSpend), "广告销售额": numeric(row.totalSales),
    "订单": numeric(row.totalOrders), "ACOS": numeric(row.acos), "ROAS": numeric(row.totalSpend) && numeric(row.totalSales)
      ? Number(row.totalSales) / Number(row.totalSpend) : null,
    "CTR": numeric(row.ctr), "CVR": numeric(row.cvr), "CPC": numeric(row.cpc), "花费占比": numeric(row.spendShare),
  }));
}

function filterMatchTypesByOwner(rows: DataRow[] | undefined, ownerName?: string): { rows: DataRow[]; filtered: boolean } {
  const values = rows ?? [];
  if (!ownerName || ownerName === "全部负责人") return { rows: values, filtered: false };
  const hasBreakdown = values.some((row) => Array.isArray(row.ownerBreakdown) && row.ownerBreakdown.length > 0);
  if (!hasBreakdown) return { rows: values, filtered: false };

  const ownerRows = values.flatMap((row) => {
    const detail = (row.ownerBreakdown as DataRow[]).find((item) => item.ownerName === ownerName);
    if (!detail) return [];
    return [{
      ...row,
      termCount: null,
      totalImpressions: detail.impressions,
      totalClicks: detail.clicks,
      totalSpend: detail.spend,
      totalOrders: detail.orders,
      totalSales: detail.sales,
      acos: detail.acos,
      cvr: detail.cvr,
      ctr: detail.ctr,
      cpc: detail.cpc,
    }];
  });
  const totalSpend = ownerRows.reduce((sum, row) => sum + (numeric(row.totalSpend) ?? 0), 0);
  return {
    rows: ownerRows.map((row) => ({ ...row, spendShare: totalSpend > 0 ? (numeric(row.totalSpend) ?? 0) / totalSpend : 0 })),
    filtered: true,
  };
}

export function buildAnalysisWorkbook(options: AnalysisExcelExportOptions): XLSX.WorkBook {
  const { result, taskName, ownerCode = "ALL", ownerName = "全部负责人" } = options;
  const workbook = XLSX.utils.book_new();
  const ownerFiltered = ownerCode !== "ALL";
  const scope = ownerFiltered ? `负责人：${ownerName}` : "全部负责人";
  const lists = result.searchTermLists ?? {};
  const analysis = result.searchTermAnalysis ?? {};
  const selectedOwner = ownerFiltered
    ? (result.ownerAnalysis ?? []).find((row) => row.ownerCode === ownerCode)
    : undefined;
  const matchTypeExport = filterMatchTypesByOwner(analysis.matchTypeAnalysis, ownerFiltered ? ownerName : undefined);
  const rootSheetName = ownerFiltered ? "词根分析（全量）" : "词根分析";
  const matchTypeSheetName = ownerFiltered && !matchTypeExport.filtered ? "匹配类型（全量）" : "匹配类型";

  appendSheet(workbook, "导出说明", [{
    "分析任务": taskName,
    "导出范围": scope,
    "导出时间": new Date().toLocaleString("zh-CN"),
    "说明": ownerFiltered
      ? "本工作簿按当前负责人筛选导出；词根分析因原始结果未保存负责人维度，明确标注为全量数据。若匹配类型缺少负责人拆分，也将明确标注为全量数据。"
      : "本工作簿由亚马逊广告智能分析系统自动生成，包含本次分析的全量汇总数据。",
  }]);
  appendSheet(workbook, "账户总览", ownerFiltered
    ? makeOwnerOverviewRows(selectedOwner, ownerName)
    : makeOverviewRows(result.accountOverview));
  appendSheet(workbook, "负责人分析", makeOwnerRows(filterByOwner(result.ownerAnalysis, ownerCode, ownerName)));
  appendSheet(workbook, "Campaign建议", makeCampaignRows(filterByOwner(result.campaignSuggestions, ownerCode, ownerName)));
  appendSheet(workbook, "Targeting建议", makeTargetingRows(filterByOwner(result.targetingSuggestions, ownerCode, ownerName)));
  appendSheet(workbook, "高价值词", makeSearchAggregateRows(filterByOwner(analysis.highValueTerms, ownerCode, ownerName)));
  appendSheet(workbook, "亏损词", makeSearchAggregateRows(filterByOwner(analysis.lossTerms, ownerCode, ownerName)));
  appendSheet(workbook, "无效词", makeSearchAggregateRows(filterByOwner(analysis.invalidTerms, ownerCode, ownerName)));
  appendSheet(workbook, "潜力词", makeSearchAggregateRows(filterByOwner(analysis.potentialTerms, ownerCode, ownerName)));
  appendSheet(workbook, "花费TOP词", makeSearchAggregateRows(filterByOwner(analysis.topTermsBySpend, ownerCode, ownerName)));
  appendSheet(workbook, rootSheetName, makeRootRows(analysis.wordRootAnalysis ?? []));
  appendSheet(workbook, matchTypeSheetName, makeMatchTypeRows(matchTypeExport.rows));
  appendSheet(workbook, "否词建议", makeSearchActionRows(filterByOwner(lists.negateList ?? lists.negate_list, ownerCode, ownerName)));
  appendSheet(workbook, "转精准", makeSearchActionRows(filterByOwner(lists.toExactList ?? lists.to_exact_list, ownerCode, ownerName)));
  appendSheet(workbook, "放大投放", makeSearchActionRows(filterByOwner(lists.amplifyList ?? lists.amplify_list, ownerCode, ownerName)));
  appendSheet(workbook, "运营动作", makeActionRows(filterByOwner(result.actionItems, ownerCode, ownerName)));
  return workbook;
}

function safeFilename(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, "_").trim() || "分析结果";
}

export type WorkbookWriter = (workbook: XLSX.WorkBook, filename: string, options: { compression: boolean }) => void;

export function downloadAnalysisWorkbook(
  options: AnalysisExcelExportOptions,
  writeFile: WorkbookWriter = (workbook, filename, writerOptions) => XLSX.writeFile(workbook, filename, writerOptions),
): string {
  const ownerSuffix = options.ownerCode && options.ownerCode !== "ALL" ? `_${options.ownerName ?? options.ownerCode}` : "";
  const filename = `亚马逊广告分析汇总_${safeFilename(options.taskName)}${safeFilename(ownerSuffix)}.xlsx`;
  writeFile(buildAnalysisWorkbook(options), filename, { compression: true });
  return filename;
}
