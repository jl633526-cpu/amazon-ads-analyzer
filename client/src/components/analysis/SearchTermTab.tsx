import { useState } from "react";
import { formatCurrency, formatPercent, formatNumber } from "@/lib/utils";
import { XCircle, Target, TrendingUp, Copy } from "lucide-react";
import { toast } from "sonner";

interface SearchTermItem {
  searchTerm: string;
  campaignName: string;
  ownerName: string;
  spend: number;
  clicks: number;
  orders: number;
  acos: number | null;
  cvr: number | null;
  reason: string;
}

interface SearchTermLists {
  negativeKeywords: SearchTermItem[];
  exactMatchConversions: SearchTermItem[];
  scaleUpTerms: SearchTermItem[];
}

interface Props {
  data: SearchTermLists;
}

const LIST_CONFIG = [
  {
    key: "negativeKeywords" as const,
    label: "否词建议",
    desc: "建议添加为否定关键词，减少无效花费",
    icon: XCircle,
    color: "text-red-400",
    bg: "bg-red-400/10",
    border: "border-red-400/20",
    headerBg: "bg-red-400/5",
  },
  {
    key: "exactMatchConversions" as const,
    label: "转精准匹配",
    desc: "高转化搜索词，建议添加为精准匹配关键词",
    icon: Target,
    color: "text-blue-400",
    bg: "bg-blue-400/10",
    border: "border-blue-400/20",
    headerBg: "bg-blue-400/5",
  },
  {
    key: "scaleUpTerms" as const,
    label: "放大投放",
    desc: "表现优秀，建议提高出价或预算进行放大",
    icon: TrendingUp,
    color: "text-emerald-400",
    bg: "bg-emerald-400/10",
    border: "border-emerald-400/20",
    headerBg: "bg-emerald-400/5",
  },
];

export default function SearchTermTab({ data }: Props) {
  const [activeList, setActiveList] = useState<"negativeKeywords" | "exactMatchConversions" | "scaleUpTerms">("negativeKeywords");

  if (!data) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        暂无Search Term数据（需要Search Term Report）
      </div>
    );
  }

  const copyTerms = (terms: SearchTermItem[]) => {
    const text = terms.map((t) => t.searchTerm).join("\n");
    navigator.clipboard.writeText(text).then(() => {
      toast.success(`已复制 ${terms.length} 个词到剪贴板`);
    });
  };

  const currentConfig = LIST_CONFIG.find((c) => c.key === activeList)!;
  const currentData = data[activeList] ?? [];

  return (
    <div className="space-y-4">
      {/* Tab切换 */}
      <div className="grid grid-cols-3 gap-3">
        {LIST_CONFIG.map((config) => {
          const count = (data[config.key] ?? []).length;
          const isActive = activeList === config.key;
          return (
            <button
              key={config.key}
              onClick={() => setActiveList(config.key)}
              className={`rounded-xl border p-4 text-left transition-all ${
                isActive
                  ? `${config.border} ${config.headerBg}`
                  : "border-border/50 bg-card hover:bg-muted/10"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${config.bg}`}>
                  <config.icon className={`h-4 w-4 ${config.color}`} />
                </div>
                <span className={`text-2xl font-bold ${isActive ? config.color : "text-foreground"}`}>
                  {count}
                </span>
              </div>
              <div className="font-medium text-sm text-foreground">{config.label}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{config.desc}</div>
            </button>
          );
        })}
      </div>

      {/* 当前列表 */}
      {currentData.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground rounded-xl border border-border/50 bg-card">
          暂无{currentConfig.label}数据
        </div>
      ) : (
        <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
          <div className={`flex items-center justify-between p-4 border-b border-border/50 ${currentConfig.headerBg}`}>
            <div className="flex items-center gap-2">
              <currentConfig.icon className={`h-4 w-4 ${currentConfig.color}`} />
              <span className="font-semibold text-sm text-foreground">
                {currentConfig.label}（{currentData.length} 个）
              </span>
            </div>
            <button
              onClick={() => copyTerms(currentData)}
              className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-card px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Copy className="h-3.5 w-3.5" />
              复制全部词
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/10">
                  {["搜索词", "Campaign", "负责人", "花费", "点击", "订单", "ACOS", "CVR", "原因"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {currentData.map((item, i) => (
                  <tr key={i} className="border-b border-border/30 hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-3">
                      <div className={`font-mono text-xs font-medium ${currentConfig.color}`}>
                        {item.searchTerm}
                      </div>
                    </td>
                    <td className="px-4 py-3 max-w-[150px]">
                      <div className="text-xs text-muted-foreground truncate" title={item.campaignName}>
                        {item.campaignName}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {item.ownerName}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-foreground">
                      {formatCurrency(item.spend)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-foreground">
                      {formatNumber(item.clicks)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-foreground">
                      {formatNumber(item.orders)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-foreground">
                      {formatPercent(item.acos)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-foreground">
                      {formatPercent(item.cvr)}
                    </td>
                    <td className="px-4 py-3 max-w-[200px]">
                      <span className="text-xs text-muted-foreground">{item.reason}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
