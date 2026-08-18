import { readFileSync } from "node:fs";
import { analyzeProductPerformance, parseProductPerformanceBuffer } from "../server/productPerformanceEngine";

const juneFile = "/home/ubuntu/upload/pasted_file_DL7t0q_产品表现ASIN（2026-06-01~2026-06-30，全部广告）-948219346787303424.xlsx";
const julyFile = "/home/ubuntu/upload/pasted_file_ClLuit_产品表现ASIN（2026-07-01~2026-07-31，全部广告）-948219279813697536.xlsx";
const june = parseProductPerformanceBuffer(readFileSync(juneFile), juneFile);
const july = parseProductPerformanceBuffer(readFileSync(julyFile), julyFile);
const result = analyzeProductPerformance(july.rows, june.rows, july.period, june.period);

console.log(JSON.stringify({
  periods: [result.priorPeriod, result.currentPeriod],
  summary: result.summary,
  owners: result.ownerSummaries.length,
  topStars: result.stars.map((item) => ({ asin: item.asin, sales: item.sales, grade: item.salesGrade })),
  topLosses: result.losses.map((item) => ({ asin: item.asin, grossProfit: item.grossProfit, margin: item.profitMargin })),
  topAttentions: result.attentions.map((item) => ({ asin: item.asin, adRate: item.adRate, margin: item.profitMargin })),
}, null, 2));
