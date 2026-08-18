import { readFile } from "node:fs/promises";
import { calcProductPerformanceAnalysis } from "../server/analysisEngine";
import { parseReportBuffer } from "../server/reportParser";

const uploadDir = "/home/ubuntu/upload";
const businessName = "产品表现.xlsx";
const advertisedName = "广告（推广的商品）报告-汇总.xlsx";

const [businessBuffer, advertisedBuffer] = await Promise.all([
  readFile(`${uploadDir}/${businessName}`),
  readFile(`${uploadDir}/${advertisedName}`),
]);

const [businessReport, advertisedReport] = await Promise.all([
  parseReportBuffer(businessBuffer, businessName),
  parseReportBuffer(advertisedBuffer, advertisedName),
]);

const analysis = calcProductPerformanceAnalysis(businessReport.rows, advertisedReport.rows);
console.log(JSON.stringify({
  businessReport: { type: businessReport.reportType, rows: businessReport.rowCount },
  advertisedReport: { type: advertisedReport.reportType, rows: advertisedReport.rowCount },
  summary: {
    totalProducts: analysis.totalProducts,
    totalSales: analysis.totalSales,
    totalAdSpend: analysis.totalAdSpend,
    tacos: analysis.tacos,
    overallCvr: analysis.overallCvr,
    labelDistribution: analysis.labelDistribution,
  },
  topProducts: analysis.products.slice(0, 3).map((product) => ({
    asin: product.asin,
    sku: product.sku,
    owner: product.ownerName,
    sales: product.totalSales,
    adSpend: product.adSpend,
    tacos: product.tacos,
    label: product.label,
  })),
}, null, 2));
