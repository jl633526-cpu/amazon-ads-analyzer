import * as XLSX from "xlsx";

type DataRow = Record<string, unknown>;

function numeric(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function addSheet(workbook: XLSX.WorkBook, name: string, rows: DataRow[]) {
  const sheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ "提示": "当前范围暂无数据" }]);
  sheet["!cols"] = Object.keys(rows[0] ?? { "提示": "" }).map((key) => ({ wch: Math.min(Math.max(key.length + 4, 14), 34) }));
  XLSX.utils.book_append_sheet(workbook, sheet, name);
}

export function buildProductAnalysisWorkbook(result: DataRow, taskName: string, ownerName = "ALL") {
  const products = ((result.products as DataRow[] | undefined) ?? []).filter((row) => ownerName === "ALL" || row.ownerName === ownerName);
  const owners = ((result.ownerSummaries as DataRow[] | undefined) ?? []).filter((row) => ownerName === "ALL" || row.ownerName === ownerName);
  const summary = result.summary as DataRow | undefined;
  const filteredSales = products.reduce((sum, row) => sum + (numeric(row.sales) ?? 0), 0);
  const filteredUnits = products.reduce((sum, row) => sum + (numeric(row.units) ?? 0), 0);
  const filteredSpend = products.reduce((sum, row) => sum + (numeric(row.adSpend) ?? 0), 0);
  const filteredProfitRows = products.filter((row) => numeric(row.grossProfit) !== null);
  const filteredProfit = filteredProfitRows.length ? filteredProfitRows.reduce((sum, row) => sum + (numeric(row.grossProfit) ?? 0), 0) : null;
  const workbook = XLSX.utils.book_new();
  addSheet(workbook, "导出说明", [{
    "分析名称": taskName,
    "导出范围": ownerName === "ALL" ? "全部负责人" : ownerName,
    "本期": result.currentPeriod ?? "—",
    "上期": result.priorPeriod ?? "—",
    "产品数": products.length,
    "销量": ownerName === "ALL" ? summary?.totalUnits ?? filteredUnits : filteredUnits,
    "销售额": ownerName === "ALL" ? summary?.totalSales ?? filteredSales : filteredSales,
    "广告费": ownerName === "ALL" ? summary?.totalAdSpend ?? filteredSpend : filteredSpend,
    "结算毛利": ownerName === "ALL" ? summary?.totalGrossProfit ?? filteredProfit : filteredProfit,
  }]);
  addSheet(workbook, "人员维度", owners.map((row) => ({
    "负责人": row.ownerName, "产品数": row.productCount, "销量": row.units, "销售额": row.sales, "广告费": row.adSpend,
    "广告费率": row.adRate, "结算毛利": row.grossProfit, "毛利率": row.profitMargin,
    "明星数": row.starCount, "亏损数": row.lossCount, "注意数": row.attentionCount,
  })));
  addSheet(workbook, "全产品分析", products.map((row) => ({
    "ASIN": row.asin, "MSKU": row.sku, "产品标题": row.title, "负责人": row.ownerName, "销量等级": row.salesGrade,
    "销量": row.units, "销售额": row.sales, "订单量": row.orders, "广告费": row.adSpend, "广告订单": row.adOrders,
    "广告费率": row.adRate, "广告单占比": row.adOrderShare, "客单价": row.averageOrderValue, "CPC": row.cpc,
    "结算毛利": row.grossProfit, "毛利率": row.profitMargin, "诊断": row.status, "诊断依据": row.statusReason,
    "建议": row.suggestion, "销量环比": row.unitsChange, "销售额环比": row.salesChange, "广告费环比": row.adSpendChange, "利润环比": row.profitChange,
  })));
  for (const [sheetName, status] of [["明星榜", "star"], ["亏损榜", "loss"], ["注意榜", "attention"]] as const) {
    addSheet(workbook, sheetName, products.filter((row) => row.status === status).slice(0, 5).map((row) => ({ "ASIN": row.asin, "负责人": row.ownerName, "销量": row.units, "销售额": row.sales, "广告费率": row.adRate, "结算毛利": row.grossProfit, "毛利率": row.profitMargin, "诊断依据": row.statusReason, "建议": row.suggestion })));
  }
  return workbook;
}

export function downloadProductAnalysisWorkbook(result: DataRow, taskName: string, ownerName = "ALL") {
  const filename = `产品表现分析_${taskName.replace(/[\\/:*?"<>|]/g, "_")}_${ownerName === "ALL" ? "全体" : ownerName}.xlsx`;
  XLSX.writeFile(buildProductAnalysisWorkbook(result, taskName, ownerName), filename, { compression: true });
  return filename;
}
