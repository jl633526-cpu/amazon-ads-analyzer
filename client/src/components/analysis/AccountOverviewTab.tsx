import { formatCurrency, formatPercent, formatNumber, getAcosColor, getCvrColor } from "@/lib/utils";
import {
  DollarSign,
  TrendingUp,
  MousePointer,
  Eye,
  ShoppingCart,
  Users,
  BarChart3,
  Activity,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";

interface AccountOverview {
  totalSpend: number;
  totalAdSales: number;
  totalOrders: number;
  totalClicks: number;
  totalImpressions: number;
  totalSessions: number;
  totalNaturalSales: number;
  totalSales: number;
  acos: number | null;
  roas: number | null;
  tacos: number | null;
  ctr: number | null;
  cvr: number | null;
  cpc: number | null;
  adSalesShare: number | null;
  naturalSalesShare: number | null;
  campaignCount: number;
  activeCampaignCount: number;
  ownerCount: number;
  acosStatus: string;
  cvrStatus: string;
  ctrStatus: string;
}

interface ReportFile {
  id: number;
  originalName: string;
  reportType: string;
  rowCount: number | null;
}

interface Props {
  data: AccountOverview;
  files: ReportFile[];
}

const METRIC_CARDS = (d: AccountOverview) => [
  {
    label: "广告总花费",
    value: formatCurrency(d.totalSpend),
    icon: DollarSign,
    color: "text-blue-400",
    bg: "bg-blue-400/10",
    sub: `CPC: ${formatCurrency(d.cpc)}`,
  },
  {
    label: "广告销售额",
    value: formatCurrency(d.totalAdSales),
    icon: TrendingUp,
    color: "text-emerald-400",
    bg: "bg-emerald-400/10",
    sub: `ROAS: ${d.roas !== null ? d.roas.toFixed(2) : "—"}x`,
  },
  {
    label: "ACOS",
    value: d.acos !== null ? formatPercent(d.acos) : "—",
    icon: BarChart3,
    color: getAcosColor(d.acosStatus),
    bg: "bg-card",
    sub: d.acosStatus,
    statusColor: getAcosColor(d.acosStatus),
  },
  {
    label: "广告订单",
    value: formatNumber(d.totalOrders),
    icon: ShoppingCart,
    color: "text-purple-400",
    bg: "bg-purple-400/10",
    sub: `CVR: ${formatPercent(d.cvr)} · ${d.cvrStatus}`,
  },
  {
    label: "总点击",
    value: formatNumber(d.totalClicks),
    icon: MousePointer,
    color: "text-yellow-400",
    bg: "bg-yellow-400/10",
    sub: `CTR: ${formatPercent(d.ctr)} · ${d.ctrStatus}`,
  },
  {
    label: "总曝光",
    value: formatNumber(d.totalImpressions),
    icon: Eye,
    color: "text-orange-400",
    bg: "bg-orange-400/10",
    sub: "曝光总量",
  },
  {
    label: "Session",
    value: formatNumber(d.totalSessions),
    icon: Activity,
    color: "text-pink-400",
    bg: "bg-pink-400/10",
    sub: d.tacos !== null ? `TACOS: ${formatPercent(d.tacos)}` : "需Business Report",
  },
  {
    label: "负责人数",
    value: String(d.ownerCount),
    icon: Users,
    color: "text-cyan-400",
    bg: "bg-cyan-400/10",
    sub: `${d.campaignCount} 个Campaign`,
  },
];

const ACOS_COLORS: Record<string, string> = {
  优秀: "#34d399",
  正常: "#60a5fa",
  预警: "#fbbf24",
  高危: "#f97316",
  极危: "#ef4444",
  阻断: "#dc2626",
  无数据: "#6b7280",
};

export default function AccountOverviewTab({ data, files }: Props) {
  const salesPieData =
    data.totalSales > 0
      ? [
          { name: "广告销售", value: data.totalAdSales, color: "#60a5fa" },
          { name: "自然销售", value: data.totalNaturalSales, color: "#34d399" },
        ]
      : null;

  const acosGaugeColor = ACOS_COLORS[data.acosStatus] ?? "#6b7280";

  return (
    <div className="space-y-6">
      {/* 指标卡片网格 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {METRIC_CARDS(data).map((card, i) => (
          <div
            key={i}
            className="rounded-xl border border-border/50 bg-card p-5 card-hover"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                {card.label}
              </span>
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${card.bg}`}>
                <card.icon className={`h-4 w-4 ${card.color}`} />
              </div>
            </div>
            <div className={`text-2xl font-bold mb-1 ${card.statusColor ?? "text-foreground"}`}>
              {card.value}
            </div>
            <div className="text-xs text-muted-foreground">{card.sub}</div>
          </div>
        ))}
      </div>

      {/* 图表区域 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 广告/自然销售占比 */}
        {salesPieData && (
          <div className="rounded-xl border border-border/50 bg-card p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4">广告 vs 自然销售占比</h3>
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={salesPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {salesPieData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{
                      background: "oklch(0.16 0.018 240)",
                      border: "1px solid oklch(0.25 0.02 240)",
                      borderRadius: "8px",
                      color: "oklch(0.93 0.008 240)",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-3 flex-shrink-0">
                {salesPieData.map((d, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full" style={{ background: d.color }} />
                    <div>
                      <div className="text-xs text-muted-foreground">{d.name}</div>
                      <div className="text-sm font-semibold text-foreground">
                        {formatCurrency(d.value)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {data.totalSales > 0
                          ? formatPercent(d.value / data.totalSales)
                          : "—"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ACOS健康状态 */}
        <div className="rounded-xl border border-border/50 bg-card p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">广告效率健康度</h3>
          <div className="space-y-4">
            {[
              { label: "ACOS", value: data.acos, status: data.acosStatus, format: formatPercent, thresholds: [0.5, 0.7, 1.0, 1.2, 1.5] },
              { label: "CVR（转化率）", value: data.cvr, status: data.cvrStatus, format: formatPercent, thresholds: null },
              { label: "CTR（点击率）", value: data.ctr, status: data.ctrStatus, format: formatPercent, thresholds: null },
            ].map((metric) => (
              <div key={metric.label}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-muted-foreground">{metric.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      {metric.value !== null ? metric.format(metric.value) : "—"}
                    </span>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{
                        color: ACOS_COLORS[metric.status] ?? "#6b7280",
                        background: `${ACOS_COLORS[metric.status] ?? "#6b7280"}20`,
                      }}
                    >
                      {metric.status}
                    </span>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: metric.value !== null ? `${Math.min(100, metric.value * 100)}%` : "0%",
                      background: ACOS_COLORS[metric.status] ?? "#6b7280",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 已上传文件信息 */}
      {files.length > 0 && (
        <div className="rounded-xl border border-border/50 bg-card p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">已分析报表</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {files.map((f) => (
              <div key={f.id} className="flex items-center gap-3 rounded-lg bg-muted/30 p-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <BarChart3 className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-foreground truncate">{f.originalName}</div>
                  <div className="text-xs text-muted-foreground">
                    {(f.rowCount ?? 0).toLocaleString()} 行
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
