import { formatCurrency, formatPercent, formatNumber, getAcosColor, getCvrColor } from "@/lib/utils";
import { Trophy, TrendingDown, AlertTriangle } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface OwnerMetrics {
  ownerCode: string;
  ownerName: string;
  spend: number;
  adSales: number;
  orders: number;
  clicks: number;
  impressions: number;
  acos: number | null;
  roas: number | null;
  ctr: number | null;
  cvr: number | null;
  cpc: number | null;
  wasteSpend: number;
  wasteRate: number | null;
  campaignCount: number;
  acosStatus: string;
  cvrStatus: string;
  rank: number;
}

interface Props {
  data: OwnerMetrics[];
  ownerFilter?: string;
}

const RANK_COLORS = ["#fbbf24", "#94a3b8", "#cd7c2f"];

export default function OwnerAnalysisTab({ data, ownerFilter = "ALL" }: Props) {
  // 如果有筛选，将选中负责人排到首位
  const displayData = ownerFilter !== "ALL"
    ? [...data].sort((a, b) =>
        a.ownerCode === ownerFilter ? -1 : b.ownerCode === ownerFilter ? 1 : 0
      )
    : data;
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        暂无负责人数据（需要Campaign Report）
      </div>
    );
  }

  const chartData = displayData.map((o) => ({
    name: o.ownerName,
    花费: o.spend,
    销售额: o.adSales,
    浪费花费: o.wasteSpend,
  }));

  // 当有筛选时，首卡展示选中负责人，其余展示全部排名前3（不筛选时显示前3）
  const topCards = ownerFilter !== "ALL"
    ? displayData.slice(0, 1) // 筛选时只展示选中负责人卡片
    : data.slice(0, 3);       // 全部模式展示前3

  return (
    <div className="space-y-6">
      {/* 排名卡片 */}
      <div className={`grid gap-4 ${ownerFilter !== "ALL" ? "grid-cols-1 max-w-sm" : "grid-cols-1 md:grid-cols-3"}`}>
        {topCards.map((owner, i) => {
          // 全部模式下使用真实排名，筛选模式下显示该负责人实际排名
          const displayRank = ownerFilter !== "ALL" ? owner.rank : i + 1;
          const rankColor = RANK_COLORS[displayRank - 1] ?? RANK_COLORS[2];
          return (
          <div
            key={owner.ownerCode}
            className={`rounded-xl border p-5 relative overflow-hidden ${
              ownerFilter !== "ALL" ? "border-primary/40 bg-primary/5" : "border-border/50 bg-card"
            }`}
          >
            <div
              className="absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold"
              style={{
                background: `${rankColor}20`,
                color: rankColor,
              }}
            >
              {displayRank === 1 ? <Trophy className="h-4 w-4" /> : `#${displayRank}`}
            </div>
            <div className="mb-3">
              <div className="text-lg font-bold text-foreground">{owner.ownerName}</div>
              <div className="text-xs text-muted-foreground">{owner.ownerCode} · {owner.campaignCount} 个Campaign</div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">花费</div>
                <div className="font-semibold text-foreground">{formatCurrency(owner.spend)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">销售额</div>
                <div className="font-semibold text-foreground">{formatCurrency(owner.adSales)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">ACOS</div>
                <div className={`font-semibold ${getAcosColor(owner.acosStatus)}`}>
                  {formatPercent(owner.acos)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">订单</div>
                <div className="font-semibold text-foreground">{formatNumber(owner.orders)}</div>
              </div>
            </div>
          </div>
          );
        })}
      </div>

      {/* 花费对比图 */}
      <div className="rounded-xl border border-border/50 bg-card p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">负责人花费 vs 销售额对比</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.02 240)" />
            <XAxis dataKey="name" tick={{ fill: "oklch(0.60 0.015 240)", fontSize: 12 }} />
            <YAxis tick={{ fill: "oklch(0.60 0.015 240)", fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              formatter={(value: number) => formatCurrency(value)}
              contentStyle={{
                background: "oklch(0.16 0.018 240)",
                border: "1px solid oklch(0.25 0.02 240)",
                borderRadius: "8px",
                color: "oklch(0.93 0.008 240)",
              }}
            />
            <Legend wrapperStyle={{ color: "oklch(0.60 0.015 240)", fontSize: 12 }} />
            <Bar dataKey="花费" fill="#60a5fa" radius={[4, 4, 0, 0]} />
            <Bar dataKey="销售额" fill="#34d399" radius={[4, 4, 0, 0]} />
            <Bar dataKey="浪费花费" fill="#f87171" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 详细表格 */}
      <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
        <div className="p-4 border-b border-border/50">
          <h3 className="text-sm font-semibold text-foreground">负责人绩效详情</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-muted/20">
                {["排名", "负责人", "花费", "销售额", "ACOS", "ROAS", "CVR", "CTR", "CPC", "订单", "浪费率", "Campaign数"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayData.map((owner) => {
                const isSelected = ownerFilter !== "ALL" && owner.ownerCode === ownerFilter;
                return (
                <tr key={owner.ownerCode} className={`border-b border-border/30 transition-colors ${isSelected ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-muted/10"}`}>
                  <td className="px-4 py-3 text-muted-foreground">#{owner.rank}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{owner.ownerName}</div>
                    <div className="text-xs text-muted-foreground">{owner.ownerCode}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-foreground">{formatCurrency(owner.spend)}</td>
                  <td className="px-4 py-3 font-mono text-foreground">{formatCurrency(owner.adSales)}</td>
                  <td className={`px-4 py-3 font-mono font-semibold ${getAcosColor(owner.acosStatus)}`}>
                    {formatPercent(owner.acos)}
                  </td>
                  <td className="px-4 py-3 font-mono text-foreground">
                    {owner.roas !== null ? owner.roas.toFixed(2) + "x" : "—"}
                  </td>
                  <td className={`px-4 py-3 font-mono ${getCvrColor(owner.cvrStatus)}`}>
                    {formatPercent(owner.cvr)}
                  </td>
                  <td className="px-4 py-3 font-mono text-foreground">{formatPercent(owner.ctr)}</td>
                  <td className="px-4 py-3 font-mono text-foreground">{formatCurrency(owner.cpc)}</td>
                  <td className="px-4 py-3 text-foreground">{formatNumber(owner.orders)}</td>
                  <td className="px-4 py-3">
                    <span className={`font-mono ${(owner.wasteRate ?? 0) > 0.3 ? "text-red-400" : "text-muted-foreground"}`}>
                      {formatPercent(owner.wasteRate)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{owner.campaignCount}</td>
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
