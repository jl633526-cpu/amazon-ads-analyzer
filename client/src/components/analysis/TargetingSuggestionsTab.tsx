import { useState } from "react";
import { formatCurrency, formatPercent, formatNumber, getAcosColor, getPriorityBadgeClass } from "@/lib/utils";
import { Filter } from "lucide-react";

interface TargetingSuggestion {
  keyword: string;
  matchType: string;
  campaignName: string;
  ownerName: string;
  spend: number;
  adSales: number;
  orders: number;
  clicks: number;
  acos: number | null;
  ctr: number | null;
  cvr: number | null;
  cpc: number | null;
  issues: string[];
  actions: string[];
  priority: "P1" | "P2" | "P3";
  acosStatus: string;
}

interface Props {
  data: TargetingSuggestion[];
  ownerFilter?: string;
  ownerName?: string;
}

export default function TargetingSuggestionsTab({ data, ownerFilter = "ALL", ownerName = "ALL" }: Props) {
  const [filter, setFilter] = useState<"ALL" | "P1" | "P2" | "P3">("ALL");

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        暂无Targeting优化建议（需要Targeting Report）
      </div>
    );
  }

  // 先按负责人过滤，再按优先级过滤
  const ownerFiltered = ownerFilter === "ALL" ? data : data.filter((d) => d.ownerName === ownerName);
  const filtered = filter === "ALL" ? ownerFiltered : ownerFiltered.filter((d) => d.priority === filter);
  const p1Count = ownerFiltered.filter((d) => d.priority === "P1").length;
  const p2Count = ownerFiltered.filter((d) => d.priority === "P2").length;
  const p3Count = ownerFiltered.filter((d) => d.priority === "P3").length;

  return (
    <div className="space-y-4">
      {/* 过滤器 */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Filter className="h-4 w-4" />
          <span>优先级筛选：</span>
        </div>
        {(["ALL", "P1", "P2", "P3"] as const).map((p) => {
          const counts: Record<string, number | string> = { ALL: data.length, P1: p1Count, P2: p2Count, P3: p3Count };
          return (
            <button
              key={p}
              onClick={() => setFilter(p)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                filter === p
                  ? p === "P1" ? "badge-p1" : p === "P2" ? "badge-p2" : p === "P3" ? "badge-p3" : "bg-primary/20 text-primary border border-primary/30"
                  : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
              }`}
            >
              {p} ({counts[p]})
            </button>
          );
        })}
        <span className="text-xs text-muted-foreground ml-auto">共 {filtered.length} 条建议</span>
      </div>

      {/* 表格 */}
      <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-muted/20">
                {["优先级", "关键词/ASIN", "匹配类型", "Campaign", "负责人", "花费", "销售额", "ACOS", "CVR", "CPC", "点击", "订单", "问题", "建议动作"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, i) => (
                <tr key={i} className="border-b border-border/30 hover:bg-muted/10 transition-colors">
                  <td className="px-4 py-3">
                    <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${getPriorityBadgeClass(item.priority)}`}>
                      {item.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3 max-w-[200px]">
                    <div className="font-mono text-xs text-foreground truncate" title={item.keyword}>
                      {item.keyword}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded bg-muted/50 text-muted-foreground">
                      {item.matchType || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 max-w-[150px]">
                    <div className="text-xs text-muted-foreground truncate" title={item.campaignName}>
                      {item.campaignName}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{item.ownerName}</td>
                  <td className="px-4 py-3 font-mono text-xs text-foreground">{formatCurrency(item.spend)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-foreground">{formatCurrency(item.adSales)}</td>
                  <td className={`px-4 py-3 font-mono text-xs font-semibold ${getAcosColor(item.acosStatus)}`}>
                    {formatPercent(item.acos)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-foreground">{formatPercent(item.cvr)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-foreground">{formatCurrency(item.cpc)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-foreground">{formatNumber(item.clicks)}</td>
                  <td className="px-4 py-3 text-xs text-foreground">{formatNumber(item.orders)}</td>
                  <td className="px-4 py-3 max-w-[200px]">
                    <ul className="space-y-0.5">
                      {item.issues.map((issue, j) => (
                        <li key={j} className="text-xs text-red-400 flex items-start gap-1">
                          <span className="flex-shrink-0">•</span>
                          <span>{issue}</span>
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="px-4 py-3 max-w-[200px]">
                    <ul className="space-y-0.5">
                      {item.actions.map((action, j) => (
                        <li key={j} className="text-xs text-emerald-400 flex items-start gap-1">
                          <span className="flex-shrink-0">→</span>
                          <span>{action}</span>
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
