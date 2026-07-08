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
  UserCircle,
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

interface ReportFile {
  id: number;
  originalName: string;
  reportType: string;
  rowCount: number | null;
}

interface Props {
  data: AccountOverview;
  files: ReportFile[];
  ownerFilter?: string;
  ownerAnalysis?: OwnerMetrics[];
}

const ACOS_COLORS: Record<string, string> = {
  优秀: "#34d399",
  正常: "#60a5fa",
  预警: "#fbbf24",
  高危: "#f97316",
  极危: "#ef4444",
  阻断: "#dc2626",
  无数据: "#6b7280",
};

function buildMetricCards(d: AccountOverview | OwnerMetrics, isOwner: boolean) {
  if (isOwner) {
    const o = d as OwnerMetrics;
    return [
      {
        label: "广告总花费",
        value: formatCurrency(o.spend),
        icon: DollarSign,
        color: "text-blue-400",
        bg: "bg-blue-400/10",
        sub: `CPC: ${formatCurrency(o.cpc)}`,
      },
      {
        label: "广告销售额",
        value: formatCurrency(o.adSales),
        icon: TrendingUp,
        color: "text-emerald-400",
        bg: "bg-emerald-400/10",
        sub: `ROAS: ${o.roas !== null ? o.roas.toFixed(2) : "—"}x`,
      },
      {
        label: "ACOS",
        value: o.acos !== null ? formatPercent(o.acos) : "—",
        icon: BarChart3,
        color: getAcosColor(o.acosStatus),
        bg: "bg-card",
        sub: o.acosStatus,
        statusColor: getAcosColor(o.acosStatus),
      },
      {
        label: "广告订单",
        value: formatNumber(o.orders),
        icon: ShoppingCart,
        color: "text-purple-400",
        bg: "bg-purple-400/10",
        sub: `CVR: ${formatPercent(o.cvr)} · ${o.cvrStatus}`,
      },
      {
        label: "总点击",
        value: formatNumber(o.clicks),
        icon: MousePointer,
        color: "text-yellow-400",
        bg: "bg-yellow-400/10",
        sub: `CTR: ${formatPercent(o.ctr)} · ${o.cvrStatus}`,
      },
      {
        label: "总曝光",
        value: formatNumber(o.impressions),
        icon: Eye,
        color: "text-orange-400",
        bg: "bg-orange-400/10",
        sub: "曝光总量",
      },
      {
        label: "浪费花费",
        value: formatCurrency(o.wasteSpend),
        icon: Activity,
        color: "text-red-400",
        bg: "bg-red-400/10",
        sub: `浪费率: ${formatPercent(o.wasteRate)}`,
      },
      {
        label: "Campaign数",
        value: String(o.campaignCount),
        icon: Users,
        color: "text-cyan-400",
        bg: "bg-cyan-400/10",
        sub: `排名 #${o.rank}`,
      },
    ];
  }

  const a = d as AccountOverview;
  return [
    {
      label: "广告总花费",
      value: formatCurrency(a.totalSpend),
      icon: DollarSign,
      color: "text-blue-400",
      bg: "bg-blue-400/10",
      sub: `CPC: ${formatCurrency(a.cpc)}`,
    },
    {
      label: "广告销售额",
      value: formatCurrency(a.totalAdSales),
      icon: TrendingUp,
      color: "text-emerald-400",
      bg: "bg-emerald-400/10",
      sub: `ROAS: ${a.roas !== null ? a.roas.toFixed(2) : "—"}x`,
    },
    {
      label: "ACOS",
      value: a.acos !== null ? formatPercent(a.acos) : "—",
      icon: BarChart3,
      color: getAcosColor(a.acosStatus),
      bg: "bg-card",
      sub: a.acosStatus,
      statusColor: getAcosColor(a.acosStatus),
    },
    {
      label: "广告订单",
      value: formatNumber(a.totalOrders),
      icon: ShoppingCart,
      color: "text-purple-400",
      bg: "bg-purple-400/10",
      sub: `CVR: ${formatPercent(a.cvr)} · ${a.cvrStatus}`,
    },
    {
      label: "总点击",
      value: formatNumber(a.totalClicks),
      icon: MousePointer,
      color: "text-yellow-400",
      bg: "bg-yellow-400/10",
      sub: `CTR: ${formatPercent(a.ctr)} · ${a.ctrStatus}`,
    },
    {
      label: "总曝光",
      value: formatNumber(a.totalImpressions),
      icon: Eye,
      color: "text-orange-400",
      bg: "bg-orange-400/10",
      sub: "曝光总量",
    },
    {
      label: "Session",
      value: formatNumber(a.totalSessions),
      icon: Activity,
      color: "text-pink-400",
      bg: "bg-pink-400/10",
      sub: a.tacos !== null ? `TACOS: ${formatPercent(a.tacos)}` : "需Business Report",
    },
    {
      label: "负责人数",
      value: String(a.ownerCount),
      icon: Users,
      color: "text-cyan-400",
      bg: "bg-cyan-400/10",
      sub: `${a.campaignCount} 个Campaign`,
    },
  ];
}

export default function AccountOverviewTab({ data, files, ownerFilter = "ALL", ownerAnalysis }: Props) {
  // 当选中了某个负责人，切换为展示该负责人的汇总指标
  const filteredOwner =
    ownerFilter !== "ALL" && ownerAnalysis
      ? ownerAnalysis.find((o) => o.ownerCode === ownerFilter)
      : null;

  const isOwnerView = !!filteredOwner;
  const displayData = filteredOwner ?? data;
  const metricCards = buildMetricCards(displayData, isOwnerView);

  const salesPieData =
    !isOwnerView && data.totalSales > 0
      ? [
          { name: "广告销售", value: data.totalAdSales, color: "#60a5fa" },
          { name: "自然销售", value: data.totalNaturalSales, color: "#34d399" },
        ]
      : null;

  const acosStatus = isOwnerView ? filteredOwner!.acosStatus : data.acosStatus;
  const cvrStatus = isOwnerView ? filteredOwner!.cvrStatus : data.cvrStatus;
  const ctrStatus = isOwnerView ? data.ctrStatus : data.ctrStatus;
  const acos = isOwnerView ? filteredOwner!.acos : data.acos;
  const cvr = isOwnerView ? filteredOwner!.cvr : data.cvr;
  const ctr = isOwnerView ? filteredOwner!.ctr : data.ctr;

  return (
    <div className="space-y-6">
      {/* 负责人视图标题 */}
      {isOwnerView && filteredOwner && (
        <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-5 py-4">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full text-base font-bold flex-shrink-0"
            style={{
              background: `hsl(${(filteredOwner.ownerCode.charCodeAt(0) * 37) % 360}, 60%, 25%)`,
              color: `hsl(${(filteredOwner.ownerCode.charCodeAt(0) * 37) % 360}, 80%, 70%)`,
            }}
          >
            {filteredOwner.ownerName.charAt(0)}
          </div>
          <div>
            <div className="font-semibold text-foreground">
              {filteredOwner.ownerName}
              <span className="ml-2 text-xs text-muted-foreground font-normal">{filteredOwner.ownerCode}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              负责 {filteredOwner.campaignCount} 个Campaign · 全账户排名 #{filteredOwner.rank}
            </div>
          </div>
          <div className="ml-auto flex items-center gap-1.5 text-xs text-primary">
            <UserCircle className="h-3.5 w-3.5" />
            负责人视图
          </div>
        </div>
      )}

      {/* 指标卡片网格 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metricCards.map((card, i) => (
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
            <div className={`text-2xl font-bold mb-1 ${'statusColor' in card ? card.statusColor : "text-foreground"}`}>
              {card.value}
            </div>
            <div className="text-xs text-muted-foreground">{card.sub}</div>
          </div>
        ))}
      </div>

      {/* 图表区域 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 广告/自然销售占比（仅全局视图显示） */}
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

        {/* 负责人视图：花费 vs 销售额对比（小型） */}
        {isOwnerView && ownerAnalysis && ownerAnalysis.length > 1 && (
          <div className="rounded-xl border border-border/50 bg-card p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4">与其他负责人对比</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart
                data={ownerAnalysis.map((o) => ({
                  name: o.ownerName,
                  花费: o.spend,
                  销售额: o.adSales,
                  isSelected: o.ownerCode === ownerFilter,
                }))}
                margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.02 240)" />
                <XAxis dataKey="name" tick={{ fill: "oklch(0.60 0.015 240)", fontSize: 10 }} />
                <YAxis tick={{ fill: "oklch(0.60 0.015 240)", fontSize: 10 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{
                    background: "oklch(0.16 0.018 240)",
                    border: "1px solid oklch(0.25 0.02 240)",
                    borderRadius: "8px",
                    color: "oklch(0.93 0.008 240)",
                  }}
                />
                <Legend wrapperStyle={{ color: "oklch(0.60 0.015 240)", fontSize: 11 }} />
                <Bar dataKey="花费" fill="#60a5fa" radius={[3, 3, 0, 0]} />
                <Bar dataKey="销售额" fill="#34d399" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ACOS健康状态 */}
        <div className="rounded-xl border border-border/50 bg-card p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">广告效率健康度</h3>
          <div className="space-y-4">
            {[
              { label: "ACOS", value: acos, status: acosStatus, format: formatPercent },
              { label: "CVR（转化率）", value: cvr, status: cvrStatus, format: formatPercent },
              { label: "CTR（点击率）", value: ctr, status: ctrStatus, format: formatPercent },
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
