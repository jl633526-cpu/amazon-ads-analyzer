import { useMemo, useState } from "react";
import { AlertTriangle, BarChart3, DollarSign, PackageSearch, ShoppingCart, TrendingUp, Users } from "lucide-react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type ProductLabel = "high_potential" | "ad_inefficient" | "conversion_risk" | "traffic_risk" | "healthy";

interface ProductPerformanceItem {
  asin: string;
  sku: string;
  ownerCode: string;
  ownerName: string;
  sessions: number;
  pageViews: number;
  units: number;
  totalSales: number;
  brCvr: number | null;
  buyboxPct: number | null;
  adSpend: number;
  adSales: number;
  adOrders: number;
  acos: number | null;
  tacos: number | null;
  adSalesShare: number | null;
  label: ProductLabel;
  labelReason: string;
  recommendation: string;
}

interface ProductPerformanceAnalysis {
  totalProducts: number;
  totalSessions: number;
  totalUnits: number;
  totalSales: number;
  totalAdSpend: number;
  totalAdSales: number;
  tacos: number | null;
  overallCvr: number | null;
  labelDistribution: Record<ProductLabel, number>;
  products: ProductPerformanceItem[];
}

const LABEL_META: Record<ProductLabel, { label: string; color: string; chip: string }> = {
  high_potential: { label: "高潜力", color: "#34d399", chip: "bg-emerald-400/10 text-emerald-400 border-emerald-400/20" },
  ad_inefficient: { label: "广告低效", color: "#f87171", chip: "bg-red-400/10 text-red-400 border-red-400/20" },
  conversion_risk: { label: "转化风险", color: "#fbbf24", chip: "bg-amber-400/10 text-amber-400 border-amber-400/20" },
  traffic_risk: { label: "流量风险", color: "#60a5fa", chip: "bg-blue-400/10 text-blue-400 border-blue-400/20" },
  healthy: { label: "健康", color: "#94a3b8", chip: "bg-slate-400/10 text-slate-300 border-slate-400/20" },
};

function money(value: number) {
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function number(value: number) {
  return value.toLocaleString("en-US");
}

function percent(value: number | null | undefined) {
  return value == null ? "—" : `${(value * 100).toFixed(1)}%`;
}

function isRiskLabel(label: ProductLabel) {
  return label === "ad_inefficient" || label === "conversion_risk" || label === "traffic_risk";
}

export default function ProductPerformanceTab({
  data,
  ownerFilter = "ALL",
}: {
  data?: ProductPerformanceAnalysis | null;
  ownerFilter?: string;
}) {
  const [labelFilter, setLabelFilter] = useState<"ALL" | ProductLabel>("ALL");
  const ownerFiltered = ownerFilter !== "ALL";
  const ownerProducts = useMemo(
    () => (data?.products ?? []).filter((item) => !ownerFiltered || item.ownerCode === ownerFilter),
    [data?.products, ownerFilter, ownerFiltered],
  );
  const products = useMemo(
    () => ownerProducts.filter((item) => labelFilter === "ALL" || item.label === labelFilter),
    [ownerProducts, labelFilter],
  );
  const summary = useMemo(() => {
    const totalSessions = ownerProducts.reduce((sum, item) => sum + item.sessions, 0);
    const totalUnits = ownerProducts.reduce((sum, item) => sum + item.units, 0);
    const totalSales = ownerProducts.reduce((sum, item) => sum + item.totalSales, 0);
    const totalAdSpend = ownerProducts.reduce((sum, item) => sum + item.adSpend, 0);
    const totalAdSales = ownerProducts.reduce((sum, item) => sum + item.adSales, 0);
    return {
      products: ownerProducts.length,
      totalSessions,
      totalUnits,
      totalSales,
      totalAdSpend,
      totalAdSales,
      tacos: totalSales > 0 ? totalAdSpend / totalSales : null,
      cvr: totalSessions > 0 ? totalUnits / totalSessions : null,
      risks: ownerProducts.filter((item) => isRiskLabel(item.label)).length,
    };
  }, [ownerProducts]);
  const hasSalesData = ownerProducts.some((item) => item.totalSales > 0);
  const chartData = useMemo(
    () => [...ownerProducts].sort((a, b) => hasSalesData ? b.totalSales - a.totalSales : b.adSpend - a.adSpend).slice(0, 8).map((item) => ({
      name: item.asin || item.sku || "未命名产品",
      value: hasSalesData ? item.totalSales : item.adSpend,
      fill: LABEL_META[item.label].color,
    })),
    [ownerProducts, hasSalesData],
  );

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <PackageSearch className="h-10 w-10 text-muted-foreground/40 mb-3" />
        <h3 className="text-sm font-semibold text-foreground">暂无产品表现分析数据</h3>
        <p className="mt-1 text-xs text-muted-foreground">请重新上传并分析含“产品表现”报告的任务，以生成ASIN/MSKU级洞察。</p>
      </div>
    );
  }

  const cards = [
    { label: "产品数", value: number(summary.products), sub: `风险产品 ${summary.risks} 个`, icon: PackageSearch, accent: "text-cyan-400", bg: "bg-cyan-400/10" },
    { label: "总销售额", value: money(summary.totalSales), sub: `广告销售 ${money(summary.totalAdSales)}`, icon: TrendingUp, accent: "text-emerald-400", bg: "bg-emerald-400/10" },
    { label: "广告总花费", value: money(summary.totalAdSpend), sub: `TACOS ${percent(summary.tacos)}`, icon: DollarSign, accent: "text-blue-400", bg: "bg-blue-400/10" },
    { label: "产品转化率", value: percent(summary.cvr), sub: `会话 ${number(summary.totalSessions)} · 销量 ${number(summary.totalUnits)}`, icon: ShoppingCart, accent: "text-amber-400", bg: "bg-amber-400/10" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">产品表现分析</h2>
          <p className="mt-1 text-sm text-muted-foreground">结合产品表现与推广商品数据，识别各ASIN/MSKU的流量、转化和广告投入效率。</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5 text-primary" />
          {ownerFiltered ? "当前为负责人筛选视图" : "全账户产品视图"}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl border border-border/50 bg-card p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{card.label}</span>
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${card.bg}`}>
                <card.icon className={`h-4 w-4 ${card.accent}`} />
              </div>
            </div>
            <div className="mt-3 text-2xl font-semibold tracking-tight text-foreground">{card.value}</div>
            <div className="mt-1 text-xs text-muted-foreground">{card.sub}</div>
          </div>
        ))}
      </div>

      {!hasSalesData && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-400/25 bg-amber-400/5 px-4 py-3 text-xs text-amber-200/90">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-400" />
          <span>当前任务未获得可关联的产品销售额，因此暂不展示有效的销售额TOP和TACOS。请在下一次分析中同时上传领星的<strong className="mx-1 text-amber-300">产品表现.xlsx</strong>，即可补全销售额、会话、产品CVR和TACOS。</span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.45fr_0.85fr]">
        <div className="rounded-xl border border-border/50 bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">{hasSalesData ? "销售额TOP产品" : "广告花费TOP产品"}</h3>
            <span className="text-xs text-muted-foreground">按{hasSalesData ? "产品销售额" : "广告花费"}排序</span>
          </div>
          <ResponsiveContainer width="100%" height={255}>
            <BarChart data={chartData} margin={{ top: 4, right: 6, left: 0, bottom: 42 }}>
              <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 10 }} angle={-28} textAnchor="end" interval={0} tickFormatter={(value) => String(value).slice(-10)} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} tickFormatter={(value) => `$${Number(value / 1000).toFixed(0)}k`} width={42} />
              <Tooltip contentStyle={{ background: "#111827", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }} formatter={(value: number) => [money(value), hasSalesData ? "销售额" : "广告花费"]} />
              <Bar dataKey="value" radius={[5, 5, 0, 0]}>
                {chartData.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-border/50 bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-foreground">产品健康分布</h3>
          </div>
          <div className="space-y-3">
            {(Object.keys(LABEL_META) as ProductLabel[]).map((label) => {
              const count = ownerProducts.filter((item) => item.label === label).length;
              const share = summary.products ? count / summary.products : 0;
              return (
                <div key={label}>
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-foreground"><span className="h-2.5 w-2.5 rounded-full" style={{ background: LABEL_META[label].color }} />{LABEL_META[label].label}</div>
                    <span className="font-medium text-muted-foreground">{count} 个 · {(share * 100).toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted/30"><div className="h-1.5 rounded-full" style={{ width: `${share * 100}%`, background: LABEL_META[label].color }} /></div>
                </div>
              );
            })}
          </div>
          <div className="mt-5 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
            <span className="font-medium text-primary">判断口径：</span>广告低效优先看ACOS/TACOS，转化风险看产品CVR，流量风险看会话量，高潜力产品可逐步扩大有效流量。
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border/30 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div><h3 className="text-sm font-semibold text-foreground">产品明细与运营建议</h3><p className="mt-0.5 text-xs text-muted-foreground">共 {products.length} 个产品；默认按销售额排序。</p></div>
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setLabelFilter("ALL")} className={`rounded-md px-2.5 py-1.5 text-xs transition-colors ${labelFilter === "ALL" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted/40"}`}>全部</button>
            {(Object.keys(LABEL_META) as ProductLabel[]).map((label) => <button key={label} onClick={() => setLabelFilter(label)} className={`rounded-md border px-2.5 py-1.5 text-xs transition-colors ${labelFilter === label ? LABEL_META[label].chip : "border-transparent text-muted-foreground hover:bg-muted/40"}`}>{LABEL_META[label].label}</button>)}
          </div>
        </div>
        <div className="max-h-[calc(100vh-260px)] overflow-x-auto overflow-y-auto">
          <table className="w-full min-w-[1380px] text-sm">
            <thead className="sticky top-0 z-10 bg-muted/60 backdrop-blur-sm"><tr className="border-b border-border/30">
              {["产品（ASIN / MSKU）", "负责人", "会话", "销量", "销售额", "产品CVR", "广告花费", "广告销售", "ACOS", "TACOS", "标签", "运营建议"].map((header) => <th key={header} className="whitespace-nowrap px-4 py-3 text-left text-xs font-medium text-muted-foreground">{header}</th>)}
            </tr></thead>
            <tbody>{products.map((item) => <tr key={`${item.asin}-${item.sku}`} className="border-b border-border/20 transition-colors hover:bg-muted/10">
              <td className="px-4 py-3"><div className="max-w-[190px] truncate font-medium text-foreground">{item.asin || "—"}</div><div className="mt-0.5 max-w-[190px] truncate text-xs text-muted-foreground">{item.sku || "未提供MSKU"}</div></td>
              <td className="px-4 py-3 text-muted-foreground">{item.ownerName}</td><td className="px-4 py-3">{number(item.sessions)}</td><td className="px-4 py-3">{number(item.units)}</td><td className="px-4 py-3 font-medium text-emerald-400">{money(item.totalSales)}</td><td className="px-4 py-3">{percent(item.brCvr)}</td><td className="px-4 py-3">{money(item.adSpend)}</td><td className="px-4 py-3">{money(item.adSales)}</td>
              <td className={`px-4 py-3 font-medium ${item.acos !== null && item.acos >= 0.8 ? "text-red-400" : item.acos !== null && item.acos >= 0.5 ? "text-amber-400" : "text-emerald-400"}`}>{percent(item.acos)}</td><td className="px-4 py-3">{percent(item.tacos)}</td>
              <td className="px-4 py-3"><span className={`inline-flex rounded-md border px-2 py-1 text-xs ${LABEL_META[item.label].chip}`}>{LABEL_META[item.label].label}</span><div className="mt-1 max-w-[180px] text-xs text-muted-foreground">{item.labelReason}</div></td>
              <td className="max-w-[270px] px-4 py-3 text-xs leading-5 text-muted-foreground">{item.recommendation}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
