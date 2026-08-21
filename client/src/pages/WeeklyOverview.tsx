import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, BarChart3, DollarSign, Loader2, MousePointerClick, ShoppingCart, Target, TrendingDown, TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { calculateChange, formatChange } from "@/lib/weeklyOverviewUtils";

type WeeklyOverviewItem = {
  taskId: number;
  name: string;
  createdAt: Date;
  periodLabel: string;
  accountOverview: {
    totalSpend: number;
    totalAdSales: number;
    totalSales: number;
    tacos: number | null;
    acos: number | null;
    totalOrders: number;
    cpc: number | null;
    adSalesShare: number | null;
  };
};

const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
const percent = (value: number | null) => value === null ? "—" : `${(value * 100).toFixed(1)}%`;

function Delta({ value, goodWhenUp = true }: { value: number | null; goodWhenUp?: boolean }) {
  if (value === null) return <span className="text-xs text-muted-foreground">暂无上期</span>;
  const positive = value >= 0;
  const good = goodWhenUp ? positive : !positive;
  return <span className={`inline-flex items-center gap-1 text-xs font-medium ${good ? "text-emerald-400" : "text-rose-400"}`}>
    {positive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
    较上期 {formatChange(value)}
  </span>;
}

export default function WeeklyOverview() {
  const [, navigate] = useLocation();
  const { data, isLoading } = trpc.analysis.weeklyOverview.useQuery();
  const weeks = (data ?? []) as WeeklyOverviewItem[];
  const latest = weeks.at(-1);
  const previous = weeks.length > 1 ? weeks.at(-2) : undefined;
  const comparison = latest && previous ? {
    sales: calculateChange(latest.accountOverview.totalSales, previous.accountOverview.totalSales),
    spend: calculateChange(latest.accountOverview.totalSpend, previous.accountOverview.totalSpend),
    orders: calculateChange(latest.accountOverview.totalOrders, previous.accountOverview.totalOrders),
    tacos: calculateChange(latest.accountOverview.tacos ?? 0, previous.accountOverview.tacos ?? 0),
  } : null;

  const chartData = weeks.map((week) => ({
    period: week.periodLabel,
    销售额: Math.round(week.accountOverview.totalSales),
    广告费: Math.round(week.accountOverview.totalSpend),
    TACOS: Number(((week.accountOverview.tacos ?? 0) * 100).toFixed(2)),
    ACOS: Number(((week.accountOverview.acos ?? 0) * 100).toFixed(2)),
  }));

  return (
    <div className="min-h-screen bg-background font-['Inter',sans-serif]">
      <nav className="border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="mr-1 h-4 w-4" /> 返回历史分析
            </Button>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" /><span className="text-sm font-medium">周度总看板对比</span></div>
          </div>
          <Button size="sm" onClick={() => navigate("/upload")}>新建分析</Button>
        </div>
      </nav>

      <main className="container max-w-7xl py-8">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-primary">Weekly business radar</p>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">总看板 · 周度对比</h1>
            <p className="mt-2 text-sm text-muted-foreground">广告费率（TACOS）= Campaign广告总花费 ÷ Business Report总销售额。当前按分析任务日期排列；后续建议任务名称填写完整周区间。</p>
          </div>
          <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">已纳入 {weeks.length} 个周期</span>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : weeks.length === 0 ? (
          <Card><CardContent className="py-20 text-center text-muted-foreground">暂无同时包含Business Report与Campaign Report的已完成分析任务。</CardContent></Card>
        ) : (
          <>
            {latest && <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="本期总销售额" value={money(latest.accountOverview.totalSales)} icon={DollarSign} delta={comparison?.sales ?? null} />
              <MetricCard label="本期广告花费" value={money(latest.accountOverview.totalSpend)} icon={Target} delta={comparison?.spend ?? null} goodWhenUp={false} />
              <MetricCard label="本期TACOS" value={percent(latest.accountOverview.tacos)} icon={TrendingDown} delta={comparison?.tacos ?? null} goodWhenUp={false} />
              <MetricCard label="本期广告订单" value={latest.accountOverview.totalOrders.toLocaleString()} icon={ShoppingCart} delta={comparison?.orders ?? null} />
            </div>}

            <div className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
              <Card className="border-border/60 bg-card/80">
                <CardHeader><CardTitle className="text-base">销售额与广告费趋势</CardTitle></CardHeader>
                <CardContent className="h-80">
                  <ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} barGap={6}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" /><XAxis dataKey="period" tickLine={false} axisLine={false} /><YAxis tickFormatter={(value) => `$${Math.round(value / 1000)}k`} tickLine={false} axisLine={false} /><Tooltip formatter={(value: number) => money(value)} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 10 }} /><Bar dataKey="销售额" fill="#22d3ee" radius={[5, 5, 0, 0]} /><Bar dataKey="广告费" fill="#f59e0b" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer>
                </CardContent>
              </Card>
              <Card className="border-border/60 bg-card/80">
                <CardHeader><CardTitle className="text-base">广告费率趋势</CardTitle></CardHeader>
                <CardContent className="h-80">
                  <ResponsiveContainer width="100%" height="100%"><LineChart data={chartData}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" /><XAxis dataKey="period" tickLine={false} axisLine={false} /><YAxis tickFormatter={(value) => `${value}%`} tickLine={false} axisLine={false} /><Tooltip formatter={(value: number) => `${value.toFixed(2)}%`} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 10 }} /><Line type="monotone" dataKey="TACOS" stroke="#22c55e" strokeWidth={2.5} dot={{ r: 4 }} /><Line type="monotone" dataKey="ACOS" stroke="#a78bfa" strokeWidth={2.5} dot={{ r: 4 }} /></LineChart></ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <Card className="mt-5 overflow-hidden border-border/60 bg-card/80">
              <CardHeader><CardTitle className="text-base">各分析批次总看板明细</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full min-w-[860px] text-sm"><thead className="bg-muted/40 text-xs text-muted-foreground"><tr><th className="px-5 py-3 text-left">任务日期</th><th className="px-5 py-3 text-right">总销售额</th><th className="px-5 py-3 text-right">广告花费</th><th className="px-5 py-3 text-right">TACOS</th><th className="px-5 py-3 text-right">ACOS</th><th className="px-5 py-3 text-right">广告销售占比</th><th className="px-5 py-3 text-right">广告订单</th><th className="px-5 py-3 text-right">CPC</th></tr></thead><tbody>{weeks.map((week) => <tr key={week.taskId} className="border-t border-border/40 hover:bg-muted/20"><td className="px-5 py-4 font-medium"><button className="text-left hover:text-primary" onClick={() => navigate(`/analysis/${week.taskId}`)}>{week.periodLabel}</button></td><td className="px-5 py-4 text-right font-medium">{money(week.accountOverview.totalSales)}</td><td className="px-5 py-4 text-right">{money(week.accountOverview.totalSpend)}</td><td className="px-5 py-4 text-right text-emerald-400">{percent(week.accountOverview.tacos)}</td><td className="px-5 py-4 text-right">{percent(week.accountOverview.acos)}</td><td className="px-5 py-4 text-right">{percent(week.accountOverview.adSalesShare)}</td><td className="px-5 py-4 text-right">{week.accountOverview.totalOrders.toLocaleString()}</td><td className="px-5 py-4 text-right">{money(week.accountOverview.cpc ?? 0)}</td></tr>)}</tbody></table>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}

function MetricCard({ label, value, icon: Icon, delta, goodWhenUp = true }: { label: string; value: string; icon: typeof DollarSign; delta: number | null; goodWhenUp?: boolean }) {
  return <Card className="border-border/60 bg-card/80"><CardContent className="p-5"><div className="mb-3 flex items-center justify-between"><span className="text-sm text-muted-foreground">{label}</span><div className="rounded-lg bg-primary/10 p-2 text-primary"><Icon className="h-4 w-4" /></div></div><div className="mb-2 text-2xl font-bold tracking-tight">{value}</div><Delta value={delta} goodWhenUp={goodWhenUp} /></CardContent></Card>;
}
