import * as XLSX from "xlsx";
import { readFile } from "node:fs/promises";

const samples = ["商品投放报告-汇总.xlsx", "用户搜索词报告-汇总.xlsx"];

async function main() {
  for (const filename of samples) {
    const workbook = XLSX.read(await readFile(`/home/ubuntu/upload/${filename}`), { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: true });
    const first = rows[0] ?? {};
    console.log(filename, JSON.stringify({
      impressions: first["曝光量"],
      clicks: first["点击"],
      ctr: first["CTR"],
      cvr: first["CVR"],
      acos: first["ACoS"],
      roas: first["ROAS"],
      matchType: first["匹配方式"],
      targeting: first["投放"],
    }));
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
