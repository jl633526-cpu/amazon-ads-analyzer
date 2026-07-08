import { useState } from "react";
import { formatCurrency, formatPercent, formatNumber, getAcosColor, getPriorityBadgeClass } from "@/lib/utils";
import { Filter, ChevronDown, ChevronUp } from "lucide-react";

interface CampaignSuggestion {
  campaignName: string;
  ownerCode: string;
  ownerName: string;
  spend: number;
  adSales: number;
  orders: number;
  clicks: number;
  acos: number | null;
  ctr: number | null;
  cvr: number | null;
  issues: string[];
  actions: string[];
  priority: "P1" | "P2" | "P3";
  acosStatus: string;
}

interface Props {
  data: CampaignSuggestion[];
  ownerFilter?: string;
}

export default function CampaignSuggestionsTab({ data, ownerFilter = "ALL" }: Props) {
  const [filter, setFilter] = useState<"ALL" | "P1" | "P2" | "P3">("ALL");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        暂无Campaign优化建议
      </div>
    );
  }

  // 先按负责人过滤，再按优先级过滤
  const ownerFiltered = ownerFilter === "ALL" ? data : data.filter((d) => d.ownerCode === ownerFilter);
  const filtered = filter === "ALL" ? ownerFiltered : ownerFiltered.filter((d) => d.priority === filter);
  const p1Count = ownerFiltered.filter((d) => d.priority === "P1").length;
  const p2Count = ownerFiltered.filter((d) => d.priority === "P2").length;
  const p3Count = ownerFiltered.filter((d) => d.priority === "P3").length;

  const toggleExpand = (name: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* 过滤器 */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Filter className="h-4 w-4" />
          <span>优先级筛选：</span>
        </div>
        {(["ALL", "P1", "P2", "P3"] as const).map((p) => {
          const counts: Record<string, number | string> = {
            ALL: data.length,
            P1: p1Count,
            P2: p2Count,
            P3: p3Count,
          };
          return (
            <button
              key={p}
              onClick={() => setFilter(p)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                filter === p
                  ? p === "P1"
                    ? "badge-p1"
                    : p === "P2"
                    ? "badge-p2"
                    : p === "P3"
                    ? "badge-p3"
                    : "bg-primary/20 text-primary border border-primary/30"
                  : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
              }`}
            >
              {p} ({counts[p]})
            </button>
          );
        })}
        <span className="text-xs text-muted-foreground ml-auto">
          共 {filtered.length} 条建议
        </span>
      </div>

      {/* 建议列表 */}
      <div className="space-y-3">
        {filtered.map((item) => {
          const isExpanded = expanded.has(item.campaignName);
          return (
            <div
              key={item.campaignName}
              className="rounded-xl border border-border/50 bg-card overflow-hidden"
            >
              {/* 标题行 */}
              <div
                className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/10 transition-colors"
                onClick={() => toggleExpand(item.campaignName)}
              >
                <span className={`flex-shrink-0 rounded-md px-2 py-0.5 text-xs font-bold ${getPriorityBadgeClass(item.priority)}`}>
                  {item.priority}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground text-sm truncate">
                    {item.campaignName}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {item.ownerName} · {item.issues.length} 个问题
                  </div>
                </div>
                {/* 关键指标 */}
                <div className="hidden sm:flex items-center gap-4 text-xs flex-shrink-0">
                  <div className="text-right">
                    <div className="text-muted-foreground">花费</div>
                    <div className="font-mono text-foreground">{formatCurrency(item.spend)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-muted-foreground">ACOS</div>
                    <div className={`font-mono font-semibold ${getAcosColor(item.acosStatus)}`}>
                      {formatPercent(item.acos)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-muted-foreground">订单</div>
                    <div className="font-mono text-foreground">{formatNumber(item.orders)}</div>
                  </div>
                </div>
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                )}
              </div>

              {/* 展开详情 */}
              {isExpanded && (
                <div className="border-t border-border/50 p-4 bg-muted/5">
                  {/* 指标行 */}
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-4">
                    {[
                      { label: "花费", value: formatCurrency(item.spend) },
                      { label: "销售额", value: formatCurrency(item.adSales) },
                      { label: "ACOS", value: formatPercent(item.acos), color: getAcosColor(item.acosStatus) },
                      { label: "CVR", value: formatPercent(item.cvr) },
                      { label: "CTR", value: formatPercent(item.ctr) },
                      { label: "点击", value: formatNumber(item.clicks) },
                    ].map((m) => (
                      <div key={m.label} className="text-center">
                        <div className="text-xs text-muted-foreground mb-1">{m.label}</div>
                        <div className={`text-sm font-mono font-semibold ${m.color ?? "text-foreground"}`}>
                          {m.value}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 问题与建议 */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs font-semibold text-red-400 mb-2 uppercase tracking-wide">
                        发现问题
                      </div>
                      <ul className="space-y-1">
                        {item.issues.map((issue, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-foreground">
                            <span className="text-red-400 mt-0.5 flex-shrink-0">•</span>
                            {issue}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-emerald-400 mb-2 uppercase tracking-wide">
                        建议动作
                      </div>
                      <ul className="space-y-1">
                        {item.actions.map((action, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-foreground">
                            <span className="text-emerald-400 mt-0.5 flex-shrink-0">→</span>
                            {action}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
