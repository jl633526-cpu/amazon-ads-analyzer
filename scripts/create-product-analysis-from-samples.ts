import { readFileSync } from "node:fs";
import {
  createProductAnalysisFile,
  createProductAnalysisTask,
  saveProductAnalysisResult,
  updateProductAnalysisTaskStatus,
} from "../server/db";
import { storagePut } from "../server/storage";
import { analyzeProductPerformance, parseProductPerformanceBuffer } from "../server/productPerformanceEngine";

const inputs = [
  { periodRole: "prior" as const, path: "/home/ubuntu/upload/pasted_file_DL7t0q_产品表现ASIN（2026-06-01~2026-06-30，全部广告）-948219346787303424.xlsx" },
  { periodRole: "current" as const, path: "/home/ubuntu/upload/pasted_file_ClLuit_产品表现ASIN（2026-07-01~2026-07-31，全部广告）-948219279813697536.xlsx" },
];

async function main() {
  const taskId = await createProductAnalysisTask(1, "产品表现分析 2026年7月（对比6月）");
  await updateProductAnalysisTaskStatus(taskId, "processing");
  const parsedByRole = new Map<"current" | "prior", ReturnType<typeof parseProductPerformanceBuffer>>();

  for (const input of inputs) {
    const buffer = readFileSync(input.path);
    const originalName = input.path.split("/").at(-1) ?? "产品表现.xlsx";
    const parsed = parseProductPerformanceBuffer(buffer, originalName);
    parsedByRole.set(input.periodRole, parsed);
    const { key, url } = await storagePut(`product-analysis/${taskId}/${Date.now()}-${input.periodRole}.xlsx`, buffer, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    await createProductAnalysisFile({ taskId, periodRole: input.periodRole, originalName, fileKey: key, fileUrl: url, rowCount: parsed.rows.length });
  }

  const current = parsedByRole.get("current")!;
  const prior = parsedByRole.get("prior")!;
  const result = analyzeProductPerformance(current.rows, prior.rows, current.period, prior.period);
  await saveProductAnalysisResult(taskId, result as unknown as Record<string, unknown>);
  await updateProductAnalysisTaskStatus(taskId, "completed");
  console.log(JSON.stringify({ taskId, currentPeriod: result.currentPeriod, priorPeriod: result.priorPeriod, products: result.summary.totalProducts }, null, 2));
}

main().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); });
