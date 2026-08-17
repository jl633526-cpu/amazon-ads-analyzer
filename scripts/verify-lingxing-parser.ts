import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { parseReportBuffer } from "../server/reportParser";

const samples = [
  "产品表现.xlsx",
  "广告（推广的商品）报告-汇总.xlsx",
  "用户搜索词报告-汇总.xlsx",
  "商品投放报告-汇总.xlsx",
  "广告活动报告-汇总.xlsx",
];

async function main() {
  const results = [];
  for (const filename of samples) {
    const filePath = join("/home/ubuntu/upload", filename);
    const parsed = await parseReportBuffer(await readFile(filePath), filename);
    results.push({
      file: basename(filename),
      reportType: parsed.reportType,
      rowCount: parsed.rowCount,
      firstRow: parsed.rows[0],
    });
  }
  console.log(JSON.stringify(results, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
