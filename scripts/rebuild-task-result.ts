import { getReportFilesByTaskId, saveAnalysisResult, updateTaskStatus } from "../server/db";
import { runFullAnalysis } from "../server/analysisEngine";
import { parseReportBuffer, type StandardRow } from "../server/reportParser";
import { storageGetSignedUrl } from "../server/storage";

const taskId = Number(process.argv[2]);
if (!Number.isInteger(taskId) || taskId <= 0) {
  throw new Error("请通过 pnpm tsx scripts/rebuild-task-result.ts <taskId> 指定任务ID");
}

const files = await getReportFilesByTaskId(taskId);
if (!files.length) throw new Error(`任务 ${taskId} 未找到已上传的报表文件`);

const rows: {
  campaignRows: StandardRow[];
  targetingRows: StandardRow[];
  searchTermRows: StandardRow[];
  advertisedProductRows: StandardRow[];
  brRows: StandardRow[];
} = { campaignRows: [], targetingRows: [], searchTermRows: [], advertisedProductRows: [], brRows: [] };

await updateTaskStatus(taskId, "processing");
try {
  for (const file of files) {
    const signedUrl = await storageGetSignedUrl(file.fileKey);
    const response = await fetch(signedUrl);
    if (!response.ok) throw new Error(`无法读取 ${file.originalName}：${response.status}`);
    const parsed = await parseReportBuffer(Buffer.from(await response.arrayBuffer()), file.originalName);
    if (parsed.reportType === "campaign_report") rows.campaignRows.push(...parsed.rows);
    if (parsed.reportType === "targeting_report") rows.targetingRows.push(...parsed.rows);
    if (parsed.reportType === "search_term_report") rows.searchTermRows.push(...parsed.rows);
    if (parsed.reportType === "advertised_product_report") rows.advertisedProductRows.push(...parsed.rows);
    if (parsed.reportType === "business_report") rows.brRows.push(...parsed.rows);
  }
  const result = runFullAnalysis(rows);
  await saveAnalysisResult(taskId, result as unknown as Record<string, unknown>);
  await updateTaskStatus(taskId, "completed");
  console.log(JSON.stringify({
    taskId,
    products: result.productPerformanceAnalysis.totalProducts,
    totalSales: result.productPerformanceAnalysis.totalSales,
    totalAdSpend: result.productPerformanceAnalysis.totalAdSpend,
  }, null, 2));
} catch (error) {
  await updateTaskStatus(taskId, "failed", String(error));
  throw error;
}
