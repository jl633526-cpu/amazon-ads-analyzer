import { useState } from "react";
import { getPriorityBadgeClass } from "@/lib/utils";
import { Download, Filter, CheckSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ActionItem {
  id: string;
  priority: "P1" | "P2" | "P3";
  category: string;
  ownerName: string;
  target: string;
  issue: string;
  action: string;
  metrics: string;
}

interface Props {
  data: ActionItem[];
  onDownload: () => void;
  ownerFilter?: string;
  ownerName?: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  "Campaign优化": "text-blue-400 bg-blue-400/10",
  "Targeting优化": "text-purple-400 bg-purple-400/10",
  "否词操作": "text-red-400 bg-red-400/10",
  "精准转化": "text-yellow-400 bg-yellow-400/10",
  "放大投放": "text-emerald-400 bg-emerald-400/10",
};

export default function ActionItemsTab({ data, onDownload, ownerFilter = "ALL", ownerName = "ALL" }: Props) {
  const [filter, setFilter] = useState<"ALL" | "P1" | "P2" | "P3">("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [checked, setChecked] = useState<Set<string>>(new Set());

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        暂无运营动作清单
      </div>
    );
  }

  // 先按负责人过滤
  const ownerFiltered = ownerFilter === "ALL" ? data : data.filter((d) => d.ownerName === ownerName);
  const categories = ["ALL", ...Array.from(new Set(ownerFiltered.map((d) => d.category)))];
  let filtered = filter === "ALL" ? ownerFiltered : ownerFiltered.filter((d) => d.priority === filter);
  if (categoryFilter !== "ALL") {
    filtered = filtered.filter((d) => d.category === categoryFilter);
  }

  const p1Count = ownerFiltered.filter((d) => d.priority === "P1").length;
  const p2Count = ownerFiltered.filter((d) => d.priority === "P2").length;
  const p3Count = ownerFiltered.filter((d) => d.priority === "P3").length;

  const toggleCheck = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* 统计卡片 */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "P1 紧急", count: p1Count, color: "text-red-400", bg: "bg-red-400/10", desc: "立即处理" },
          { label: "P2 重要", count: p2Count, color: "text-yellow-400", bg: "bg-yellow-400/10", desc: "本周处理" },
          { label: "P3 优化", count: p3Count, color: "text-blue-400", bg: "bg-blue-400/10", desc: "下周处理" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border/50 bg-card p-4 text-center">
            <div className={`text-3xl font-bold ${s.color} mb-1`}>{s.count}</div>
            <div className="font-medium text-sm text-foreground">{s.label}</div>
            <div className="text-xs text-muted-foreground">{s.desc}</div>
          </div>
        ))}
      </div>

      {/* 过滤器 */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Filter className="h-4 w-4" />
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
        <div className="h-4 w-px bg-border" />
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              categoryFilter === cat
                ? "bg-primary/20 text-primary border border-primary/30"
                : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
            }`}
          >
            {cat}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {checked.size > 0 ? `已完成 ${checked.size} 项` : `共 ${filtered.length} 项`}
          </span>
          <Button size="sm" variant="outline" onClick={onDownload}>
            <Download className="h-4 w-4 mr-1" />
            下载CSV
          </Button>
        </div>
      </div>

      {/* 清单表格 */}
      <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-muted/20">
                <th className="px-4 py-3 w-10"></th>
                {["#", "优先级", "类别", "负责人", "目标对象", "发现问题", "建议动作", "关键指标"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const isDone = checked.has(item.id);
                return (
                  <tr
                    key={item.id}
                    className={`border-b border-border/30 transition-colors ${
                      isDone ? "opacity-40" : "hover:bg-muted/10"
                    }`}
                  >
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleCheck(item.id)}
                        className={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${
                          isDone
                            ? "border-emerald-400 bg-emerald-400/20 text-emerald-400"
                            : "border-border text-transparent hover:border-primary"
                        }`}
                      >
                        {isDone && <CheckSquare className="h-3.5 w-3.5" />}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{item.id}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${getPriorityBadgeClass(item.priority)}`}>
                        {item.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${CATEGORY_COLORS[item.category] ?? "text-muted-foreground bg-muted/30"}`}>
                        {item.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{item.ownerName}</td>
                    <td className="px-4 py-3 max-w-[160px]">
                      <div className="text-xs text-foreground truncate font-mono" title={item.target}>
                        {item.target}
                      </div>
                    </td>
                    <td className="px-4 py-3 max-w-[200px]">
                      <div className="text-xs text-red-400">{item.issue}</div>
                    </td>
                    <td className="px-4 py-3 max-w-[220px]">
                      <div className="text-xs text-emerald-400">{item.action}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-muted-foreground font-mono whitespace-nowrap">{item.metrics}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
